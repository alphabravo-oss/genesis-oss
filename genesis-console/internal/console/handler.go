package console

import (
	"context"
	"errors"
	"log"
	"time"

	"connectrpc.com/connect"
	consolev1 "github.com/alphabravo/genesis-console/gen/console/v1"
	"github.com/jackc/pgx/v5"
)

type Handler struct {
	svc         *Service
	connections *Connections
}

func NewHandler(svc *Service, connections *Connections) *Handler {
	return &Handler{svc: svc, connections: connections}
}

func (h *Handler) ListReleases(ctx context.Context, _ *connect.Request[consolev1.ListReleasesRequest]) (*connect.Response[consolev1.ListReleasesResponse], error) {
	rows, err := h.svc.List(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&consolev1.ListReleasesResponse{Releases: rows, LoadedAt: h.svc.LoadedAt()}), nil
}

func (h *Handler) GetRelease(ctx context.Context, req *connect.Request[consolev1.GetReleaseRequest]) (*connect.Response[consolev1.ReleaseDetail], error) {
	detail, err := h.svc.Get(ctx, req.Msg.GetTag())
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, connect.NewError(connect.CodeNotFound, err)
	}
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(detail), nil
}

func (h *Handler) GetCluster(ctx context.Context, req *connect.Request[consolev1.GetClusterRequest]) (*connect.Response[consolev1.ClusterStatus], error) {
	if err := validateComparison(req.Msg.Tag, req.Msg.Profiles); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	return connect.NewResponse(h.svc.Inspect(ctx, req.Msg.Tag, req.Msg.Profiles, req.Msg.UseRecordedProfiles)), nil
}

func (h *Handler) GetPackageComparison(ctx context.Context, req *connect.Request[consolev1.GetPackageComparisonRequest]) (*connect.Response[consolev1.PackageComparison], error) {
	if err := validateComparison(req.Msg.Tag, req.Msg.Profiles); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	result, err := h.svc.PackageComparison(ctx, req.Msg.Tag, req.Msg.Profiles, req.Msg.PackageKey, req.Msg.UseRecordedProfiles)
	if err != nil {
		return nil, connect.NewError(connect.CodeNotFound, err)
	}
	return connect.NewResponse(result), nil
}

func (h *Handler) StartScan(ctx context.Context, req *connect.Request[consolev1.StartScanRequest]) (*connect.Response[consolev1.ScanJob], error) {
	job, err := h.svc.StartScan(ctx, req.Msg.GetTag(), req.Msg.GetScope(), req.Msg.GetImageIds())
	if err != nil {
		return nil, scanErr(err)
	}
	return connect.NewResponse(job), nil
}

func (h *Handler) ListScanJobs(ctx context.Context, _ *connect.Request[consolev1.ListScanJobsRequest]) (*connect.Response[consolev1.ListScanJobsResponse], error) {
	jobs, err := h.svc.ListScanJobs(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&consolev1.ListScanJobsResponse{Jobs: jobs}), nil
}

func (h *Handler) GetScanJob(ctx context.Context, req *connect.Request[consolev1.GetScanJobRequest]) (*connect.Response[consolev1.ScanJob], error) {
	job, err := h.svc.GetScanJob(ctx, req.Msg.GetId())
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, connect.NewError(connect.CodeNotFound, err)
	}
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(job), nil
}

func (h *Handler) GetScanSettings(ctx context.Context, _ *connect.Request[consolev1.GetScanSettingsRequest]) (*connect.Response[consolev1.ScanSettings], error) {
	auto, err := h.svc.ScanSettings(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&consolev1.ScanSettings{AutoClean: auto}), nil
}

func (h *Handler) SetScanSettings(ctx context.Context, req *connect.Request[consolev1.SetScanSettingsRequest]) (*connect.Response[consolev1.ScanSettings], error) {
	if err := h.svc.SetAutoClean(ctx, req.Msg.GetAutoClean()); err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&consolev1.ScanSettings{AutoClean: req.Msg.GetAutoClean()}), nil
}

func (h *Handler) CleanImages(ctx context.Context, _ *connect.Request[consolev1.CleanImagesRequest]) (*connect.Response[consolev1.CleanImagesResponse], error) {
	if err := h.svc.CleanImages(ctx); err != nil {
		return nil, scanErr(err)
	}
	return connect.NewResponse(&consolev1.CleanImagesResponse{Cleaned: true}), nil
}

func scanErr(err error) error {
	switch {
	case errors.Is(err, errBadScope), errors.Is(err, errBadSelection):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, errBusy), errors.Is(err, errPodInventory), errors.Is(err, pgx.ErrNoRows):
		code := connect.CodeFailedPrecondition
		if errors.Is(err, pgx.ErrNoRows) {
			code = connect.CodeNotFound
		}
		return connect.NewError(code, err)
	default:
		if err.Error() == "trivy is not installed" {
			return connect.NewError(connect.CodeFailedPrecondition, err)
		}
		return connect.NewError(connect.CodeInternal, err)
	}
}

func (h *Handler) GetConnection(_ context.Context, _ *connect.Request[consolev1.GetConnectionRequest]) (*connect.Response[consolev1.ConnectionInfo], error) {
	return connect.NewResponse(connectionInfoProto(h.connections.Info())), nil
}

func (h *Handler) TestConnection(ctx context.Context, req *connect.Request[consolev1.ConnectionInput]) (*connect.Response[consolev1.ConnectionTest], error) {
	test, err := h.connections.Test(ctx, connectionInput(req.Msg))
	if err != nil {
		return nil, connectionErr(err)
	}
	return connect.NewResponse(&consolev1.ConnectionTest{
		Contexts: test.Contexts, Context: test.Context, Server: test.Server, Loopback: test.Loopback,
		KubernetesVersion: test.KubernetesVersion, Release: test.Release, GenesisVersion: test.GenesisVersion,
		Warnings: test.Warnings, Error: test.Error,
	}), nil
}

func (h *Handler) SaveConnection(ctx context.Context, req *connect.Request[consolev1.ConnectionInput]) (*connect.Response[consolev1.ConnectionInfo], error) {
	info, err := h.connections.Save(ctx, connectionInput(req.Msg))
	if err != nil {
		return nil, connectionErr(err)
	}
	return connect.NewResponse(connectionInfoProto(info)), nil
}

func (h *Handler) DeleteConnection(ctx context.Context, _ *connect.Request[consolev1.DeleteConnectionRequest]) (*connect.Response[consolev1.ConnectionInfo], error) {
	info, err := h.connections.Delete(ctx)
	if err != nil {
		return nil, internalErr(err, "The saved connection could not be removed. Try again.")
	}
	return connect.NewResponse(connectionInfoProto(info)), nil
}

func connectionInput(msg *consolev1.ConnectionInput) ConnectionInput {
	return ConnectionInput{Name: msg.Name, Kubeconfig: msg.Kubeconfig, Context: msg.Context, RewriteLoopback: msg.RewriteLoopback}
}

func connectionInfoProto(info ConnectionInfo) *consolev1.ConnectionInfo {
	out := &consolev1.ConnectionInfo{Name: info.Name, Source: info.Source, Server: info.Server, Context: info.Context, SavingEnabled: info.SavingEnabled, Warnings: info.Warnings, Error: info.Error}
	if !info.SavedAt.IsZero() {
		out.SavedAt = info.SavedAt.UTC().Format(time.RFC3339)
	}
	return out
}

func connectionErr(err error) error {
	var user kubeconfigError
	switch {
	case errors.As(err, &user):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, errNoConnectionKey):
		return connect.NewError(connect.CodeFailedPrecondition, err)
	default:
		return internalErr(err, "The connection could not be tested or saved. Check the console logs.")
	}
}

// internalErr logs the cause for the operator and shows the user a fixed message.
// Causes here come from the database, filesystem, or crypto, never kubeconfig content.
func internalErr(err error, message string) error {
	log.Printf("cluster connection: %v", err)
	return connect.NewError(connect.CodeInternal, errors.New(message))
}

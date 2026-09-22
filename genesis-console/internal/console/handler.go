package console

import (
	"context"
	"errors"

	"connectrpc.com/connect"
	consolev1 "github.com/alphabravo/genesis-console/gen/console/v1"
	"github.com/jackc/pgx/v5"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
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

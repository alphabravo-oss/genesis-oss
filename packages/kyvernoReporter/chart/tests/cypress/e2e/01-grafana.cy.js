// Validates panel data should not be zero
Cypress.Commands.add('panelnotzero', (name) => {
  cy.get('[data-testid="data-testid Panel header ' + name + '"]')
    .contains(/^[1-9][0-9]*$/)
})

// Log in
before (function() {
  cy.env(['grafana_url', 'grafana_user', 'grafana_pass']).then(({ grafana_url, grafana_user, grafana_pass }) => {
    cy.visit(grafana_url)
    cy.performGrafanaLogin(grafana_user, grafana_pass)
  })
})

// Save cookies so we don't have to log in again
beforeEach(function () {
  cy.env(['grafana_url']).then(({ grafana_url }) => {
    cy.visit(`${grafana_url}/dashboards`)
  })
})

describe('Validate Grafana Dashboards', {
  retries: {
    runMode: 4,
  }
}, () => {
  it('Validate Cluster Policy Report Details Dashboard', () => {
    cy.env(['check_datasource']).then(({ check_datasource }) => {
      if (!check_datasource) return
      cy.loadGrafanaDashboard("ClusterPolicyReport Details")
      cy.panelnotzero('Policy Pass Status')
      cy.panelnotzero('Policy Fail Status')
    })
  })
  it('Validate Policy Report Details Dashboard', () => {
    cy.env(['check_datasource']).then(({ check_datasource }) => {
      if (!check_datasource) return
      cy.loadGrafanaDashboard("PolicyReport Details")
      cy.panelnotzero('Policy Pass Status')
      cy.panelnotzero('Policy Fail Status')
    })
  })
  it('Validate Policy Reports Dashboard', () => {
    cy.env(['check_datasource']).then(({ check_datasource }) => {
      if (!check_datasource) return
      cy.loadGrafanaDashboard("PolicyReports")
      cy.panelnotzero('Failing ClusterPolicies')
    })
  })
})

// Clear cookies to force login again
after(() => {
  cy.clearAllUserData()
})

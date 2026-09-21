describe('Alertmanager unit testing', function() {
  // Prevent unhandled JS errors in the Alertmanager UI from failing the test
  Cypress.on('uncaught:exception', () => false)

  before(function() {
    cy.env(['alertmanager_url', 'keycloak_test_enable', 'tnr_username', 'tnr_password']).then(({ alertmanager_url, keycloak_test_enable, tnr_username, tnr_password }) => {

      // Verify Alertmanager API is healthy before testing UI
      cy.request(`${alertmanager_url}/-/healthy`).its('status').should('eq', 200)

      cy.visit(alertmanager_url)

      if (keycloak_test_enable === true || keycloak_test_enable === 'true') {
        cy.performKeycloakLogin(tnr_username, tnr_password)
      }

      cy.wait(200)
    })
  })

  it('Test alertmanager UI loads and groups expand', function() {
    cy.contains("Expand all groups").click()
    cy.wait(500)
    cy.contains("Collapse all groups").click()
  })
})

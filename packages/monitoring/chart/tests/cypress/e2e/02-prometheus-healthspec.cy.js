describe('Basic prometheus', function() {
  it('Visits the prometheus sign in page', function() {

    cy.env(['prometheus_url', 'keycloak_test_enable', 'tnr_username', 'tnr_password']).then(({ prometheus_url, keycloak_test_enable, tnr_username, tnr_password }) => {

      cy.visit(prometheus_url)

      if (keycloak_test_enable === true || keycloak_test_enable === 'true') {
        cy.performKeycloakLogin(tnr_username, tnr_password)
      } else {
        cy.get('body').then(($body) => {
          if ($body.find('input[name="user"]').length != 0) {
            cy.performGrafanaLogin('admin', 'prom-operator')
          }
        })
      }

      cy.wait(200)

      cy.get('div[class="cm-line"]')
        .type('kube_node_info{enter}')

      // Run a query and verify it completes without error
      cy.get('button').contains("Execute")
        .click({waitForAnimations: false})

      // Wait for query to complete - verify no error banner appears
      cy.wait(1000)
      cy.get('body').should('not.contain', 'Error executing query')
    })
  })
})

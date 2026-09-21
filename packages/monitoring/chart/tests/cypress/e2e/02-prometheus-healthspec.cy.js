import { completeKeycloakLogin } from './login.cy.js'

const assertPromQueryUi = () => {
  cy.get('div[class="cm-line"]', { timeout: 30000 })
    .type('kube_node_info{enter}')

  // Run a query and verify it completes without error
  cy.get('button').contains('Execute')
    .click({ waitForAnimations: false })

  // Wait for query to complete - verify no error banner appears
  cy.wait(1000)
  cy.get('body').should('not.contain', 'Error executing query')
}

describe('Basic prometheus', function() {
  it('Visits the prometheus sign in page', function() {

    cy.env(['prometheus_url', 'keycloak_test_enable', 'tnr_username', 'tnr_password']).then(({ prometheus_url, keycloak_test_enable, tnr_username, tnr_password }) => {
      const sso = keycloak_test_enable === true || keycloak_test_enable === 'true'
      const appOrigin = new URL(prometheus_url).origin

      cy.visit(prometheus_url)

      cy.url().then((landedUrl) => {
        if (sso && !landedUrl.startsWith(appOrigin)) {
          completeKeycloakLogin(appOrigin, tnr_username, tnr_password)
          cy.origin(prometheus_url, assertPromQueryUi)
        } else {
          if (!sso) {
            cy.get('body').then(($body) => {
              if ($body.find('input[name="user"]').length != 0) {
                cy.performGrafanaLogin('admin', 'prom-operator')
              }
            })
          }
          assertPromQueryUi()
        }
      })
    })
  })
})

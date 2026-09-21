import { completeKeycloakLogin } from './login.cy.js'

const assertAlertmanagerUi = () => {
  cy.reload()
  cy.contains('Expand all groups', { timeout: 30000 }).click()
  cy.contains('Collapse all groups').click()
}

describe('Alertmanager unit testing', function() {
  // Prevent unhandled JS errors in the Alertmanager UI from failing the test
  Cypress.on('uncaught:exception', () => false)

  let wrapInAppOrigin = false
  let amUrl = ''

  before(function() {
    cy.env(['alertmanager_url', 'keycloak_test_enable', 'tnr_username', 'tnr_password']).then(({ alertmanager_url, keycloak_test_enable, tnr_username, tnr_password }) => {
      amUrl = alertmanager_url
      const sso = keycloak_test_enable === true || keycloak_test_enable === 'true'
      const appOrigin = new URL(alertmanager_url).origin

      cy.visit(alertmanager_url)

      cy.url().then((landedUrl) => {
        if (sso && !landedUrl.startsWith(appOrigin)) {
          wrapInAppOrigin = true
          completeKeycloakLogin(appOrigin, tnr_username, tnr_password)
        }

        // Verify Alertmanager API is healthy before testing UI
        cy.request(`${alertmanager_url}/-/healthy`).its('status').should('eq', 200)
      })
    })
  })

  it('Test alertmanager UI loads and groups expand', function() {
    if (wrapInAppOrigin) {
      cy.origin(amUrl, assertAlertmanagerUi)
    } else {
      assertAlertmanagerUi()
    }
  })
})

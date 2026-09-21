const assertMainDashboard = () => {
  cy.contains('Policy Reporter', { timeout: 30000 })

  cy.contains('Cluster Scoped Results').should('exist')
  cy.contains('Cluster Resources').should('exist')
  cy.contains('Namespace Scoped Resources').should('exist')
}

const assertPolicyDashboard = () => {
  cy.contains(/policy dashboard/i, { timeout: 30000 })
    .scrollIntoView()
    .click({ force: true })

  cy.location('hash', { timeout: 30000 })
    .should('not.eq', '')

  cy.contains('Security', { timeout: 30000 }).should('exist')
  cy.contains('Vulnerability').should('exist')

  // Anchor the video on the last visible element
  cy.contains('Best Practices')
    .should('exist')
    .scrollIntoView()
}

describe('Validate Policy Reporter UI Dashboards', {
  retries: {
    runMode: 6,
  }
}, () => {

  let wrapInAppOrigin = false
  let uiUrl = ''

  before(function () {
    cy.env(['policyreporter_ui', 'keycloak_test_enable', 'tnr_username', 'tnr_password']).then(({ policyreporter_ui, keycloak_test_enable, tnr_username, tnr_password }) => {
      uiUrl = policyreporter_ui
      const sso = keycloak_test_enable === true || keycloak_test_enable === 'true'
      const appOrigin = new URL(policyreporter_ui).origin

      if (sso) {
        // With SSO enabled, unauthenticated requests must end up at Keycloak
        cy.request({ url: policyreporter_ui, followRedirect: true, failOnStatusCode: false }).then((resp) => {
          const chain = (resp.redirects || []).join(' ')
          expect(chain, `${policyreporter_ui} should redirect unauthenticated requests to Keycloak`).to.include('/realms/')
        })
      }

      cy.visit(policyreporter_ui)

      cy.url().then((landedUrl) => {
        if (sso && !landedUrl.startsWith(appOrigin)) {
          wrapInAppOrigin = true
          cy.url().then((url) => {
            if (!url.includes('required-action')) {
              cy.get('input[id="username"]').type(tnr_username)
              cy.get('input[id="password"]').type(tnr_password, { log: false })
              cy.get('input[id="kc-login"]').click()
            }
          })
          for (let i = 0; i < 2; i++) {
            cy.url({ timeout: 30000 }).should('satisfy', (url) =>
              url.startsWith(appOrigin) || url.includes('required-action')
            ).then((url) => {
              if (url.includes('TERMS_AND_CONDITIONS')) {
                cy.get('input[id="kc-accept"]').click()
              } else if (url.includes('OAUTH_GRANT')) {
                cy.get('input[id="kc-login"]').click()
              }
            })
          }
          cy.url({ timeout: 30000 }).should('satisfy', (url) => url.startsWith(appOrigin))
        }
      })
    })
  })

  it('Validate main dashboard widgets exist', () => {
    if (wrapInAppOrigin) {
      cy.origin(uiUrl, assertMainDashboard)
    } else {
      assertMainDashboard()
    }
  })

  it('Navigate to Policy Dashboard and validate categories', () => {
    if (wrapInAppOrigin) {
      cy.origin(uiUrl, assertPolicyDashboard)
    } else {
      assertPolicyDashboard()
    }
  })

})

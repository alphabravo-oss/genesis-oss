// Shared keycloak/authservice login helper for the monitoring cypress specs.
// Named *.cy.js so the gluon runner copies it into the pod; the placeholder
// test below keeps it a valid spec.
export const completeKeycloakLogin = (appOrigin, username, password) => {
  cy.url().then((url) => {
    if (!url.includes('required-action')) {
      cy.get('input[id="username"]').type(username)
      cy.get('input[id="password"]').type(password, { log: false })
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

// An unauthenticated request to an SSO-protected app must be redirected to Keycloak.
// cy.request carries the browser cookies, so cookies are cleared first.
export const expectSsoRedirect = (url) => {
  cy.request({ url, followRedirect: false, failOnStatusCode: false }).then((resp) => {
    expect(resp.status, `${url} should redirect unauthenticated requests`).to.be.oneOf([302, 303, 307])
    expect(resp.headers.location, `${url} should redirect to Keycloak`).to.include('/realms/')
  })
}

describe('SSO enforcement', () => {
  it('sends unauthenticated prometheus and alertmanager requests to Keycloak', function () {
    const sso = Cypress.env('keycloak_test_enable') === true || Cypress.env('keycloak_test_enable') === 'true'
    if (!sso) {
      this.skip()
    }
    cy.clearCookies()
    expectSsoRedirect(Cypress.env('prometheus_url'))
    expectSsoRedirect(Cypress.env('alertmanager_url'))
  })
})

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

// Placeholder so this file is a valid spec. Keep it a no-op.
describe('shared login helper', () => {
  it('exports completeKeycloakLogin (no-op placeholder)', () => {
    expect(completeKeycloakLogin).to.be.a('function')
  })
})

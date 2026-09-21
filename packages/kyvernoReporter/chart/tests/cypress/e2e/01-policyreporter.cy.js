describe('Validate Policy Reporter UI Dashboards', {
  retries: {
    runMode: 6,
  }
}, () => {

  before(function () {
    cy.env(['policyreporter_ui']).then(({ policyreporter_ui }) => {
      cy.visit(policyreporter_ui)
    })
  })

  it('Validate main dashboard widgets exist', () => {

    cy.contains('Policy Reporter', { timeout: 30000 })

    cy.contains('Cluster Scoped Results').should('exist')
    cy.contains('Cluster Resources').should('exist')
    cy.contains('Namespace Scoped Resources').should('exist')
  })

  it('Navigate to Policy Dashboard and validate categories', () => {

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
  })

})

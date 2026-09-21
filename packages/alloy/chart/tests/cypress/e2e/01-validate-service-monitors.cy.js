const retryConfig = {
  retries: {
    runMode: 10
  },
};

Cypress.Commands.add('validatePromTargetNew', (monitorText, match) => {
    cy.get(`input[placeholder*="Select scrape pool"]`)
      .click({force: true})
    cy.get(`div[value="${monitorText}"]`)
      .click({force: true})
    cy.contains(monitorText)
      .should('exist')
    cy.contains(match)
      .should('exist')
  })
  
describe('Alloy Targets', retryConfig, () => {
  
  const variableUpMatch = /\d+\s\/\s\d+\sup/;
  
  if (Cypress.env('bigbang_integration')) {
    it('Validate Alloy Logs service monitors are running', function () {
      cy.visit(`${Cypress.env('prometheus_url')}/targets`)
      cy.validatePromTargetNew('serviceMonitor\/alloy\/alloy-logs\/0', variableUpMatch)
    })
  }
  else {
    it('Validate Alloy Logs service monitors are running pipe', function () {
      cy.visit(`${Cypress.env('prometheus_url')}/targets`)
      cy.validatePromTargetNew('serviceMonitor\/alloy\/alloy-alloy-logs\/0', variableUpMatch)
    })
  }
})
Cypress.on('uncaught:exception', (err, runnable) => {
  // returning false here prevents Cypress from failing the test
  // gitlab throws this error in the console which by default fails the cypress test
  return false
})

let changedPassword = null

function resetPasswordIfPrompted() {
  cy.get('body').then($body => {
    const hasResetModal = $body.find('mat-dialog-container app-reset-password-modal').length > 0
    if (!hasResetModal) return
    const newPwd = 'cypressPwd!1'

    // Scope to the dialog to avoid selector bleed
    cy.get('mat-dialog-container app-reset-password-modal').within(() => {
      cy.get('input[formcontrolname="newPassword"]', { timeout: 10000 })
        .should('be.visible')
        .type(newPwd, { log: false })

      cy.get('input[formcontrolname="confirmPassword"]')
        .type(newPwd, { log: false })

      // Wait for button to enable then submit
      cy.get('#reset-password-dialog-submit')
        .should('not.be.disabled')
        .click()
    })

    // Ensure the dialog is gone and landing UI appears
    cy.get('mat-dialog-container', { timeout: 20000 }).should('not.exist')

    // Persist the new credential for the rest of this run
    changedPassword = newPwd
  })
}

// Login to NeuVector before each test
beforeEach(function () {
  cy.window().then(window => window.sessionStorage.clear());
  cy.clearCookies();
  cy.clearLocalStorage();

  cy.viewport(1920, 1080)

  cy.env(['url', 'password']).then(({ url, password }) => {
    if (Cypress.env('keycloak_test_enable')) {
      cy.session('keycloak-sso', () => {
        cy.visit(url)
        cy.title().should('contain', 'NeuVector')
        cy.get('body').then($body => {
          if ($body.find('div.mdc-checkbox').length > 0) {
            cy.get('div.mdc-checkbox').find('input').click({ force: true })
          }
        })
        cy.contains('button', 'OpenID', { matchCase: false, timeout: 30000 })
          .should('not.be.disabled')
          .click()
        const keycloakOrigin = new URL(Cypress.env('keycloak_url')).origin
        cy.origin(
          keycloakOrigin,
          { args: { username: Cypress.env('tnr_username'), password: Cypress.env('tnr_password') } },
          ({ username, password }) => {
            cy.url({ timeout: 30000 }).then(currentUrl => {
              if (!currentUrl.includes('required-action')) {
                cy.get('input#username', { timeout: 30000 }).type(username)
                cy.get('input#password').type(password, { log: false })
                cy.get('input#kc-login').click()
              }
            })

            for (let i = 0; i < 2; i++) {
              cy.url({ timeout: 30000 }).then(currentUrl => {
                if (currentUrl.includes('TERMS_AND_CONDITIONS')) {
                  cy.get('input#kc-accept', { timeout: 30000 }).click()
                } else if (currentUrl.includes('OAUTH_GRANT')) {
                  cy.get('input#kc-login', { timeout: 30000 }).click()
                }
              })
            }
          }
        )
        cy.url({ timeout: 30000 }).should('include', new URL(url).hostname)
        cy.get('app-exposure-chart', { timeout: 60000 })
      })
      cy.visit(url)
      cy.get('app-exposure-chart', { timeout: 60000 })
      return
    }

    const passPrimary = changedPassword || password || 'changeme$!'
    const passFallback = 'cypressPwd!1' // fallback password

    function attemptLogin(username, pwd) {
      cy.visit(url)
      cy.title().should('contain', 'NeuVector')

      cy.get('input[id="Email1"]').clear().type(username)
      cy.get('input[id="password1"]').clear().type(pwd)

      cy.get('body').then($body => {
        if ($body.find('div.mdc-checkbox').length == 0) {
          cy.get('button[type="submit"]').click({ force: true })
        } else {
          cy.get('div.mdc-checkbox').find('input').click({ force: true })
          cy.get('button[type="submit"]').click({ force: true })
        }
      })

      cy.wait(2000)
      resetPasswordIfPrompted()

      // Check if dashboard element exists to confirm login success
      return cy.get('body').then($b => {
        if ($b.find('app-exposure-chart').length > 0) {
          return true
        } else {
          return false
        }
      })
    }

    // Try first login, then fallback if needed
    attemptLogin('admin', passPrimary).then(success => {
      if (!success) {
        cy.log('Primary login failed, trying fallback (admin/cypressPwd!1)')
        attemptLogin('admin', passFallback)
      }
    })
  })
})

// Basic test that validates Dashboard panels exist
it('Check Dashboard Panels', {
  retries: {
    runMode: 4,
    openMode: 4
  }
}, () => {
  cy.get('app-exposure-chart')
  cy.get('app-policy-mode-panel[assettype="services"]')
  cy.get('app-policy-mode-panel[assettype="containers"]')
  cy.get('app-application-protocols-panel')
})

// Basic test that validates system component health
it('Check System Components',
  {
    retries: {
      runMode: 4,
      openMode: 4
    }
  }, () => {
    cy.get('nav.sidebar > ul').contains("Assets").click()
    cy.get('nav.sidebar > ul').contains("System Components").click()
    cy.wait(2000)
    cy.get('div[role="row"] > div[col-id="connection_state"] > app-controllers-grid-status-cell > span').contains("Connected")
    cy.get('div[role="tablist"]').contains("Scanners").click()
    cy.wait(2000)
    cy.get('app-scanners-grid').contains(/[1-9]/)
    cy.get('div[role="tablist"]').contains("Enforcers").click()
    cy.wait(2000)
    cy.get('div[role="row"] > div[col-id="connection_state"] > app-enforcers-grid-status-cell > span').contains("Connected")
  })

// Basic test that scans an image and validates results/success
it('Scan an image',
  {
    retries: {
      runMode: 4,
      openMode: 4
    }
  }, () => {
    cy.get('nav.sidebar > ul').contains("Assets").click()
    cy.get('nav.sidebar > ul').contains("Containers").click()
    cy.wait(1000)

    // Get a container that has not been scanned
    cy.get('div[role="rowgroup"] > div.ag-row div[col-id="security.scan_summary.status"] > app-containers-grid-status-cell:empty')
      .first()
      .parents('div.ag-row')
      .click()
      .then($row => {
        cy.get('button[aria-label="Scan action"]')
          .click()
          .then(() => {
            cy.intercept('/workload/scanned?start=0&limit=2000')
              .as('scanned')

            // When the scan is complete grid reloads, wait for that request to fire
            cy.wait('@scanned', { timeout: 90000 })

            const rowName = $row.find('app-containers-grid-name-cell')[0].innerText
            const rowId = $row.attr('row-id');

            // Type in container name to ensure row is visible
            cy.get('app-quick-filter input').type(rowName)

            // Fetch row by id
            cy.get(`div[role='rowgroup'] > div.ag-row[row-id='${rowId}']`)
              .find('app-containers-grid-status-cell', { timeout: 60000 })
              .should('contain', 'Finished', { timeout: 60000 })
          })
      })
  })

// Check compliance and validate Kubernetes CIS results
it('Check Host Compliance',
  {
    retries: {
      runMode: 4,
      openMode: 4
    }
  }, () => {
    cy.wait(1000)
    cy.get('nav.sidebar > ul').contains('Security Risks').click()
    cy.get('nav.sidebar > ul').contains('Compliance Profile').click()
    
    cy.get('mat-form-field.quick-filter input')
      .click()
      .clear()
      .type('kubernetes')
      .type('{enter}')
      .click();

    cy.contains('kubernetes')
      .first()
      .click()
      .should('contain', 'kubernetes', { timeout: 1000 })
  })


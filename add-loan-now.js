// Script to add the loan of EGP 40,000
const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')

const serviceAccount = {
  type: "service_account",
  project_id: "teluaseghapp",
  private_key_id: "fbb9296d1c27652feb0067db06816892dd560c6f",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDH04crbgRxQk15\nICBrlFLRmKy5ddiIr5yKAmu0qj/HHsA9lWEDlSfVauhCu2hEpjQbmtbHkRp2zDkY\nRek2i1F3d6PNaFMPMsw95745krrdHoyKc9PgVsUos0k9vyjTSgCMm4HuRq2/9iiM\n4PYhHQy8x4dnD46e/fyTcLhcAD+X7BWm3cIbzLF0lzq+gf1ufUF+BWskncl4r3sS\n2PQwcN67Hu6A6/riJI2mb9WL5jjIy/Uog69KkQv4ZEFnYUFG9e+f1ywv7z2eU7AN\nbtcXMpuNN/shB8ty81Hx6RH3RhfLxAaqdhw/dX935WfKCq2ZOqGYEVxux4jf56n5\n00cKmqzdAgMBAAECggEACXhq9ZH3P+7mgREWuEKFUk2sEfYV1xSLlLbcp+lRsHwy\nnDiSKntNMf4pF9CN9oLyAUTrXPXxjSPMqOvXS7B6ofDXoIqLNTMxHtX22/+qP4SN\nIJqwtfcmzPECTZzbsHfXYtKT69kJrwlZjqOyxor76Y6DSk0gc0SSTeKPujyAxxBh\n1SR8dfqHt4nCIs6KG4YeM6MMuvZ23/NRaBQLOUsOL99C481wC8jvbmAynnG0bxaX\nst/SDqzAOdU918R+rei9fsOpodntAoH0IEejBHnWfmY3gKpEm+MfpwhrUHLOc+Bi\nfmpVBLSJ0DzbqZkxUtujwXnMJk89NP4yRtAoz4CauQKBgQDvaIz0vOibN7vaSCSz\nyN+OyT7A12r30TzwHX6XIrNVgLFOeHcLLGpkoPRXZeEiSHhqErm1baNww98jWxQT\nK7jVjw/zz/f/SSNtm4q6wN4ljL0GRt1BiEUm1P6RJuSnVfjuHUQGblebpcvzYJqQ\nHmRWEmnOaT/dbGDg0Kt8NlSGqwKBgQDVrLvRSd/TeJK1Tz26Op1kGLts+q3N/k2r\nz9Bys+Da6d2nsWShJOoxpmYlaRV/71hsd+jju7puUefidPLPSe/XA/1rrk1ij/Ux\nnJrQVe4DlPHQ2ArItXVV9YNIiAFDEn1ChTcTwNV7PytuRmvA1ZX0uR9C2D+sa9P9\n/e5LGrW6lwKBgQCJlX0EHRhUM3hqnnExPOx1I2RD8MiReJbbqyeX9aI4Lgg3f3Vy\nX2kZQYKKQ4tZZ2qEExTUlhiKcpZmvC3SQpsrZ9cUF91+wWpx0CSu5K4FyFbNJ6Z5\nxbVv9pIBmudm3zp6pSj1xS3lzidiS48n6b9h050ouUWxm1oleOZEMPjslwKBgGaR\nYxrkrkeRskLMReI2LsUUxita7cFbGCeoOvREemQ7LMZJdfeQg8bPjGra1ZIy7ywq\nJyXiQGyiboAbCU8Nu85nwOdGpSjx1444EWx+QyF/BtDsU8jiqe9YSeuwNYLfxjb/\nQV//Cbr+qLdnoGPRYwk1L9djfLUkkX9zvEZbDO8DAoGAEsYuZR94sx+qNi4qyCiR\ndST6dSpDF3OqckdXxoRZUz+sMbngqjW/TGWxGgb49toNDzCzoj78qNYQbsLqDRnk\nhcZY3+zqnvVcEfD6uRx6JjFOfi8EGpnhtXE9p9cNwGvyKGHO/NzXauFNyJTfxEwQ\ns5LdR6uW2I1DV6V/+DSTyvo=\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-erdcc@teluaseghapp.iam.gserviceaccount.com",
  client_id: "115086862820657581958",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-erdcc%40teluaseghapp.iam.gserviceaccount.com",
  universe_document: "googleapis.com",
}

const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: "teluaseghapp",
})

const db = getFirestore()

async function addLoanNow() {
  try {
    console.log("💰 Adding loan of EGP 40,000...")
    
    const now = new Date()
    const loanAmount = 40000
    
    // 1. Create journal entry for the loan
    const journalEntry = {
      date: now,
      entries: [
        {
          account_id: "CASH",
          debit: loanAmount,
          credit: 0,
          description: `Business loan received - EGP ${loanAmount.toLocaleString()}`
        },
        {
          account_id: "SHORT_TERM_DEBT",
          debit: 0,
          credit: loanAmount,
          description: `Loan payable - EGP ${loanAmount.toLocaleString()}`
        }
      ],
      linked_doc: `LOAN_${Date.now()}`,
      created_at: now
    }
    
    await db.collection('acc_journal_entries').add(journalEntry)
    console.log(`✅ Created journal entry for loan: EGP ${loanAmount.toLocaleString()}`)
    
    // 2. Update CASH balance in Chart of Accounts
    const cashRef = db.collection('acc_chart_of_accounts').doc('CASH')
    const cashDoc = await cashRef.get()
    const currentCashBalance = cashDoc.data()?.balance || 0
    const newCashBalance = currentCashBalance + loanAmount
    
    await cashRef.update({
      balance: newCashBalance,
      last_updated: now
    })
    
    console.log(`✅ Updated CASH balance:`)
    console.log(`  Previous: EGP ${currentCashBalance.toLocaleString()}`)
    console.log(`  New: EGP ${newCashBalance.toLocaleString()}`)
    
    // 3. Update SHORT_TERM_DEBT balance in Chart of Accounts
    const debtRef = db.collection('acc_chart_of_accounts').doc('SHORT_TERM_DEBT')
    const debtDoc = await debtRef.get()
    const currentDebtBalance = debtDoc.data()?.balance || 0
    const newDebtBalance = currentDebtBalance + loanAmount
    
    await debtRef.update({
      balance: newDebtBalance,
      last_updated: now
    })
    
    console.log(`✅ Updated SHORT_TERM_DEBT balance:`)
    console.log(`  Previous: EGP ${currentDebtBalance.toLocaleString()}`)
    console.log(`  New: EGP ${newDebtBalance.toLocaleString()}`)
    
    // 4. Show accounting impact
    console.log(`\n📊 Accounting Impact:`)
    console.log(`  Assets (CASH): +EGP ${loanAmount.toLocaleString()}`)
    console.log(`  Liabilities (SHORT_TERM_DEBT): +EGP ${loanAmount.toLocaleString()}`)
    console.log(`  Balance Sheet: Still balanced ✅`)
    
    // 5. Show updated Balance Sheet preview
    console.log(`\n📋 Updated Balance Sheet Preview:`)
    console.log(`  Current Assets:`)
    console.log(`    Cash: EGP ${newCashBalance.toLocaleString()}`)
    console.log(`  Current Liabilities:`)
    console.log(`    Short-term Debt: EGP ${newDebtBalance.toLocaleString()}`)
    
    console.log(`\n🎯 Loan successfully recorded!`)
    console.log(`  You now have EGP ${loanAmount.toLocaleString()} more cash`)
    console.log(`  You owe EGP ${loanAmount.toLocaleString()} in short-term debt`)
    console.log(`\n🔄 Please refresh your browser to see the updated Balance Sheet!`)
    
  } catch (error) {
    console.error("Error adding loan:", error)
  }
}

addLoanNow().then(() => process.exit(0))

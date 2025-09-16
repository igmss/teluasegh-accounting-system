const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = {
  type: "service_account",
  project_id: "teluaseghapp",
  private_key_id: "your-private-key-id",
  private_key: "your-private-key",
  client_email: "firebase-adminsdk-erdcc@teluaseghapp.iam.gserviceaccount.com",
  client_id: "your-client-id",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-erdcc%40teluaseghapp.iam.gserviceaccount.com"
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixDesignCosts() {
  try {
    console.log('🔧 Starting design cost fix...');
    
    // Get all designs
    const designsSnapshot = await db.collection('acc_designs').get();
    const designs = designsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`📊 Found ${designs.length} designs to fix`);
    
    let fixed = 0;
    const errors = [];
    
    for (const design of designs) {
      try {
        // Calculate correct total cost
        const correctTotalCost = (design.materialCost || 0) + (design.laborCost || 0) + (design.overheadCost || 0);
        
        // Only update if totalCost is incorrect
        if (design.totalCost !== correctTotalCost) {
          console.log(`🔧 Fixing design "${design.name}": ${design.totalCost} → ${correctTotalCost}`);
          
          await db.collection('acc_designs').doc(design.id).update({
            totalCost: correctTotalCost,
            updatedAt: new Date()
          });
          
          fixed++;
        }
      } catch (error) {
        console.error(`❌ Error fixing design ${design.id}:`, error);
        errors.push(`Design ${design.name}: ${error.message}`);
      }
    }
    
    console.log(`✅ Fixed ${fixed} designs`);
    console.log(`❌ Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('Errors:', errors);
    }
    
  } catch (error) {
    console.error('❌ Error fixing design costs:', error);
  }
}

// Run the fix
fixDesignCosts().then(() => {
  console.log('Done!');
  process.exit(0);
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});

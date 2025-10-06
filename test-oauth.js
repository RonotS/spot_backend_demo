import './config.js'; // Load configuration first
import { JiraAuthService } from './auth-service.js';

async function testOAuth() {
  console.log('🧪 Testing OAuth configuration...');
  
  const authService = new JiraAuthService();
  
  // Test OAuth URL generation
  const authUrl = authService.generateOAuthUrl('test-state');
  console.log('🔗 Generated OAuth URL:');
  console.log(authUrl);
  
  // Parse the URL to check scopes
  const url = new URL(authUrl);
  const scope = url.searchParams.get('scope');
  console.log('🔍 Scopes in URL:', scope);
  
  // Check if all required parameters are present
  console.log('🔍 Client ID:', url.searchParams.get('client_id'));
  console.log('🔍 Redirect URI:', url.searchParams.get('redirect_uri'));
  console.log('🔍 Response Type:', url.searchParams.get('response_type'));
  
  // Test with a dummy code to see what error we get
  console.log('\n🧪 Testing token exchange with dummy code...');
  try {
    await authService.exchangeCodeForTokens('dummy-code-for-testing');
  } catch (error) {
    console.log('❌ Expected error with dummy code:', error.message);
  }
}

testOAuth();

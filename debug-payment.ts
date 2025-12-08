
import axios from 'axios';

async function testPayment() {
    try {
        // 1. Signup always to ensure user exists
        const email = 'test_pay_' + Date.now() + '@example.com';
        console.log('Signing up as ' + email);
        const authRes = await axios.post('http://localhost:3001/api/auth/signup', {
            email: email,
            password: 'password123',
            fullName: 'Payment Tester'
        });
        const token = authRes.data.token;
        console.log('Got token:', token ? 'Yes' : 'No');

        // 2. Create Checkout Session
        console.log('Creating checkout session...');
        // Use a dummy price ID that is formatted like a valid one to avoid regex validation errors if any, 
        // though "price_test_123" is fine usually.
        const response = await axios.post('http://localhost:3001/api/payment/create-checkout-session', {
            priceId: 'price_fake_12345',
            mode: 'subscription'
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('Session URL:', response.data.url);
    } catch (error: any) {
        console.log('Error status:', error.response?.status);
        if (error.response?.data) {
            console.log('Error data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.log('Error:', error.message);
        }
    }
}

testPayment();

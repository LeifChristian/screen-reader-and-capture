import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

console.log('🔍 Testing OpenAI API Key...\n');

if (!OPENAI_API_KEY) {
    console.error('❌ ERROR: No OpenAI API key found in .env file');
    process.exit(1);
}

console.log(`API Key format: ${OPENAI_API_KEY.substring(0, 10)}...${OPENAI_API_KEY.substring(OPENAI_API_KEY.length - 10)}`);
console.log(`API Key length: ${OPENAI_API_KEY.length} characters\n`);

// Test API key with a simple text completion
async function testApiKey() {
    try {
        console.log('Testing basic API access...');

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'user',
                        content: 'Hello! Just testing the API. Please respond with "API Test Successful".'
                    }
                ],
                max_tokens: 10
            })
        });

        console.log(`Response status: ${response.status}`);
        console.log(`Response headers:`, response.headers.raw());

        const data = await response.json();
        console.log('Full response:', JSON.stringify(data, null, 2));

        if (data.error) {
            console.error('❌ API Error:', data.error.message);
            console.error('Error type:', data.error.type);
            console.error('Error code:', data.error.code);
            return false;
        }

        console.log('✅ Basic API access: SUCCESS');
        console.log('Response:', data.choices[0].message.content);
        return true;

    } catch (error) {
        console.error('❌ API Test failed:', error.message);
        console.error('Error stack:', error.stack);
        return false;
    }
}

// Test vision models
async function testVisionModels() {
    const models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'];

    console.log('\n🔍 Testing vision model access...');

    // Create a simple test image (1x1 pixel PNG)
    const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    for (const model of models) {
        try {
            console.log(`Testing ${model}...`);

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text: 'What do you see in this image? Just respond with "Vision test successful".'
                                },
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: `data:image/png;base64,${testImage}`
                                    }
                                }
                            ]
                        }
                    ],
                    max_tokens: 10
                })
            });

            const data = await response.json();

            if (data.error) {
                console.log(`❌ ${model}: ${data.error.message}`);
                console.log(`   Error type: ${data.error.type}`);
                console.log(`   Error code: ${data.error.code}`);
            } else {
                console.log(`✅ ${model}: SUCCESS`);
                console.log(`   Response: ${data.choices[0].message.content}`);
                return model; // Return the working model
            }

        } catch (error) {
            console.log(`❌ ${model}: ${error.message}`);
        }
    }

    return null;
}

// Main test function
async function runTests() {
    const basicTest = await testApiKey();

    if (!basicTest) {
        console.log('\n❌ Basic API test failed. Please check your API key.');
        console.log('\nTroubleshooting steps:');
        console.log('1. Verify your API key is correct in the .env file');
        console.log('2. Check if you have sufficient credits');
        console.log('3. Ensure your API key has the correct permissions');
        console.log('4. Make sure the API key starts with "sk-" and is the correct length');
        return;
    }

    const workingModel = await testVisionModels();

    if (!workingModel) {
        console.log('\n❌ No vision models are accessible with your API key.');
        console.log('\nPossible solutions:');
        console.log('1. Your API key may not have access to GPT-4 vision models');
        console.log('2. You may need to upgrade your OpenAI plan');
        console.log('3. Check if your organization has restricted access');
        console.log('4. Verify you have sufficient credits for GPT-4 usage');
    } else {
        console.log(`\n✅ Success! Your API key works with ${workingModel}`);
        console.log('Your Queue Watcher should now work properly!');
    }
}

runTests();

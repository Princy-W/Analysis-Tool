document.addEventListener('DOMContentLoaded', function() {
    // UI Elements
    const apiKeyInput = document.getElementById('apiKey');
    const toggleApiKeyBtn = document.getElementById('toggleApiKey');
    const responseMethodSelect = document.getElementById('responseMethod');
    const singleResponseInput = document.getElementById('singleResponseInput');
    const batchResponseInput = document.getElementById('batchResponseInput');
    const questionInput = document.getElementById('question');
    const responseInput = document.getElementById('response');
    const jsonInput = document.getElementById('jsonInput');
    const batchSize = document.getElementById('batchSize');
    const batchSizeValue = document.getElementById('batchSizeValue');
    const fileUpload = document.getElementById('fileUpload');
    const analyzeSingleBtn = document.getElementById('analyzeSingleBtn');
    const analyzeBatchBtn = document.getElementById('analyzeBatchBtn');
    const loadExampleBtn = document.getElementById('loadExampleBtn');
    const resultsContainer = document.getElementById('resultsContainer');
    const progressSection = document.getElementById('progressSection');
    const progressBar = document.getElementById('progressBar');
    const progressStatus = document.getElementById('progressStatus');
    const progressCount = document.getElementById('progressCount');
    const progressTime = document.getElementById('progressTime');
    
    // Error modal
    const errorModal = new bootstrap.Modal(document.getElementById('errorModal'));
    const errorModalBody = document.getElementById('errorModalBody');
    
    // Global variables to store results
    let analysisResults = [];
    let startTime = null;
    
    // Check if API key is stored in local storage
    if (localStorage.getItem('geminiApiKey')) {
        apiKeyInput.value = localStorage.getItem('geminiApiKey');
    }
    
    // Toggle API key visibility
    toggleApiKeyBtn.addEventListener('click', function() {
        if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
            toggleApiKeyBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
        } else {
            apiKeyInput.type = 'password';
            toggleApiKeyBtn.innerHTML = '<i class="fas fa-eye"></i>';
        }
    });
    
    // Switch between single and batch input
    responseMethodSelect.addEventListener('change', function() {
        if (this.value === 'single') {
            singleResponseInput.style.display = 'block';
            batchResponseInput.style.display = 'none';
        } else {
            singleResponseInput.style.display = 'none';
            batchResponseInput.style.display = 'block';
        }
    });
    
    // Update batch size value
    batchSize.addEventListener('input', function() {
        batchSizeValue.textContent = this.value;
    });
    
    // Handle file upload
    fileUpload.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                jsonInput.value = JSON.stringify(data, null, 2);
                responseMethodSelect.value = 'batch';
                responseMethodSelect.dispatchEvent(new Event('change'));
            } catch (error) {
                showError('Invalid JSON file. Please check the file format.');
            }
        };
        reader.readAsText(file);
    });
    
    // Load example data
    loadExampleBtn.addEventListener('click', function() {
        const exampleData = [
            {
                "question": "Do you have a kitchen in your home, and what furniture items are there?",
                "response": "Yes, I do have a kitchen in my home. It has a refrigerator, stove, microwave, and dishwasher. There's also a table with four chairs where we eat breakfast."
            },
            {
                "question": "What is your hobby and how often do you do it?",
                "response": "My hobby is playing guitar. I practice almost everyday for about one hour. Sometimes I play with my friends on weekends. I've been playing guitar for three years."
            },
            {
                "question": "Describe your hometown and what you like about it.",
                "response": "I live in small city near ocean. Its very beautiful with beaches and mountains. The people are friendly and food is amazing. I like the weather because not too hot or cold."
            }
        ];
        
        jsonInput.value = JSON.stringify(exampleData, null, 2);
        responseMethodSelect.value = 'batch';
        responseMethodSelect.dispatchEvent(new Event('change'));
    });
    
    // Analyze single response
    analyzeSingleBtn.addEventListener('click', async function() {
        const apiKey = apiKeyInput.value.trim();
        const question = questionInput.value.trim();
        const response = responseInput.value.trim();
        
        if (!validateInputs(apiKey, question, response)) return;
        
        // Save API key to local storage
        localStorage.setItem('geminiApiKey', apiKey);
        
        // Reset UI
        resetUI();
        showLoading();
        
        try {
            const analysis = await analyzeResponse(apiKey, question, response);
            displaySingleAnalysis(analysis, question, response);
        } catch (error) {
            showError(`Analysis failed: ${error.message}`);
            resetOutput();
        }
    });
    
    // Analyze batch of responses
    analyzeBatchBtn.addEventListener('click', async function() {
        const apiKey = apiKeyInput.value.trim();
        let jsonData;
        
        try {
            jsonData = JSON.parse(jsonInput.value);
            if (!Array.isArray(jsonData)) {
                throw new Error('Input must be an array of objects');
            }
        } catch (error) {
            showError(`Invalid JSON: ${error.message}`);
            return;
        }
        
        if (!apiKey) {
            showError('API key is required');
            return;
        }
        
        // Save API key to local storage
        localStorage.setItem('geminiApiKey', apiKey);
        
        // Reset UI
        resetUI();
        
        // Set up progress tracking
        const maxBatchSize = parseInt(batchSize.value);
        progressSection.style.display = 'block';
        progressBar.style.width = '0%';
        progressBar.textContent = '0%';
        progressCount.textContent = `0/${Math.min(jsonData.length, maxBatchSize)} completed`;
        progressTime.textContent = 'Estimated time: calculating...';
        startTime = new Date();
        
        try {
            await processBatch(apiKey, jsonData, maxBatchSize);
        } catch (error) {
            showError(`Batch analysis failed: ${error.message}`);
            resetOutput();
        }
    });
    
    // Process batch of responses
    async function processBatch(apiKey, jsonData, maxBatchSize) {
        const batchResults = [];
        const total = Math.min(jsonData.length, maxBatchSize);
        
        resultsContainer.innerHTML = '<div class="text-center p-5"><div class="loading-spinner mb-3"></div><h4>Processing responses...</h4></div>';
        
        // Update progress function
        const updateProgress = (current) => {
            const percentage = Math.round((current / total) * 100);
            progressBar.style.width = `${percentage}%`;
            progressBar.textContent = `${percentage}%`;
            progressCount.textContent = `${current}/${total} completed`;
            
            // Calculate estimated time remaining
            if (current > 0 && startTime) {
                const elapsed = (new Date() - startTime) / 1000; // seconds
                const avgTimePerItem = elapsed / current;
                const remaining = avgTimePerItem * (total - current);
                
                let timeText;
                if (remaining < 60) {
                    timeText = `${Math.round(remaining)} seconds`;
                } else {
                    timeText = `${Math.round(remaining / 60)} minutes`;
                }
                
                progressTime.textContent = `Estimated time: ${timeText} remaining`;
            }
        };
        
        for (let i = 0; i < total; i++) {
            const item = jsonData[i];
            progressStatus.textContent = `Processing response ${i+1} of ${total}...`;
            
            if (!item.question || !item.response) {
                batchResults.push({
                    question: item.question || 'Missing question',
                    response: item.response || 'Missing response',
                    error: 'Missing question or response',
                    analysis: null
                });
                continue;
            }
            
            try {
                const analysis = await analyzeResponse(apiKey, item.question, item.response);
                batchResults.push({
                    question: item.question,
                    response: item.response,
                    analysis: analysis
                });
            } catch (error) {
                batchResults.push({
                    question: item.question,
                    response: item.response,
                    error: error.message,
                    analysis: null
                });
            }
            
            // Update progress
            updateProgress(i + 1);
            
            // Display current results
            displayBatchResults(batchResults);
            
            // Add a small delay between requests to avoid rate limiting
            if (i < total - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // Store results globally for reference
        analysisResults = batchResults;
        
        // Update progress status
        progressStatus.textContent = 'Analysis complete!';
        progressBar.classList.remove('progress-bar-animated');
    }
    
    // Analyze a single response using Gemini API
    async function analyzeResponse(apiKey, question, response) {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        const promptText = `
            For English language assessment, please analyze this response in detail:
            
            Question: "${question}"
            Response: "${response}"

            Provide a detailed breakdown of how you evaluate this response across these four areas:
            
            1. Grammar Accuracy
            2. Content Organization
            3. Listening Comprehension
            4. Vocabulary
            
            For each area:
            - Assign a score from 1-5
            - List 3 specific strengths with examples from the response
            - List 3 areas for improvement with examples from the response
            - Explain your scoring criteria
            
            Finally, provide an overall score from 1-5 and a summary of the evaluation.
            
            Format the response as JSON with the following structure:
            {
              "overallScore": number,
              "summary": "text",
              "categories": [
                {
                  "name": "Grammar Accuracy",
                  "score": number,
                  "strengths": ["point 1", "point 2", "point 3"],
                  "improvements": ["point 1", "point 2", "point 3"],
                  "criteria": "text"
                },
                // Similar objects for other categories
              ]
            }
        `;
        
        const requestData = {
            contents: [{
                parts: [{ text: promptText }]
            }]
        };
        
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API error: ${errorData.error.message || response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts) {
                throw new Error('Invalid response from Gemini API');
            }
            
            const textContent = data.candidates[0].content.parts[0].text;
            
            // Try to parse JSON from the response
            try {
                // Find JSON in the response
                const jsonMatch = textContent.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                } else {
                    // If no JSON is found, create a structured object from the text
                    return createStructuredAnalysis(textContent);
                }
            } catch (parseError) {
                // If JSON parsing fails, create a structured object from the text
                return createStructuredAnalysis(textContent);
            }
            
        } catch (error) {
            console.error('Error calling Gemini API:', error);
            throw error;
        }
    }
    
    // Create structured analysis from text if JSON parsing fails
    function createStructuredAnalysis(text) {
        // Default structure
        const analysis = {
            overallScore: 3,
            summary: "Analysis completed but structured data could not be extracted.",
            categories: [
                {
                    name: "Grammar Accuracy",
                    score: 3,
                    strengths: [],
                    improvements: [],
                    criteria: ""
                },

                    {
                        name: "Content Organization",
                        score: 3,
                        strengths: [],
                        improvements: [],
                        criteria: ""
                    },
                    {
                        name: "Listening Comprehension",
                        score: 3,
                        strengths: [],
                        improvements: [],
                        criteria: ""
                    },
                    {
                        name: "Vocabulary",
                        score: 3,
                        strengths: [],
                        improvements: [],
                        criteria: ""
                    }
                ],
                rawText: text
            };
            
            // Try to extract scores from text
            const overallScoreMatch = text.match(/overall score:?\s*(\d+)/i);
            if (overallScoreMatch) {
                analysis.overallScore = parseInt(overallScoreMatch[1]);
            }
            
            // Try to extract category scores
            const categories = ["Grammar Accuracy", "Content Organization", "Listening Comprehension", "Vocabulary"];
            categories.forEach((category, index) => {
                const scoreMatch = text.match(new RegExp(category + "[^\\d]+(\\d+)", "i"));
                if (scoreMatch) {
                    analysis.categories[index].score = parseInt(scoreMatch[1]);
                }
            });
            
            return analysis;
        }
        
        // Display single analysis result
        function displaySingleAnalysis(analysis, question, response) {
            // Store the result
            analysisResults = [{
                question: question,
                response: response,
                analysis: analysis
            }];
            
            // Create HTML for the analysis
            resultsContainer.innerHTML = createAnalysisHTML(analysis, question, response);
        }
        
        // Display batch results
        function displayBatchResults(results) {
            let html = '';
            
            results.forEach((result, index) => {
                if (result.error) {
                    html += createErrorHTML(result, index);
                } else if (result.analysis) {
                    html += createAnalysisHTML(result.analysis, result.question, result.response, index);
                }
            });
            
            resultsContainer.innerHTML = html;
        }
        
        // Create HTML for analysis result
        function createAnalysisHTML(analysis, question, response, index) {
            // Function to get color class based on score
            const getScoreColorClass = (score) => {
                if (score >= 5) return 'score-5';
                if (score >= 4) return 'score-4';
                if (score >= 3) return 'score-3';
                if (score >= 2) return 'score-2';
                return 'score-1';
            };
            
            // Function to get score label
            const getScoreLabel = (score) => {
                if (score >= 5) return 'Excellent';
                if (score >= 4) return 'Good';
                if (score >= 3) return 'Satisfactory';
                if (score >= 2) return 'Needs Improvement';
                return 'Poor';
            };
            
            // Create categories HTML
            let categoriesHTML = '';
            
            if (analysis.categories && Array.isArray(analysis.categories)) {
                analysis.categories.forEach(category => {
                    // Create strengths list
                    let strengthsHTML = '<ul class="strengths-list">';
                    if (category.strengths && Array.isArray(category.strengths)) {
                        category.strengths.forEach(strength => {
                            strengthsHTML += `<li>${escapeHTML(strength)}</li>`;
                        });
                    } else {
                        strengthsHTML += '<li>No specific strengths identified</li>';
                    }
                    strengthsHTML += '</ul>';
                    
                    // Create improvements list
                    let improvementsHTML = '<ul class="improvements-list">';
                    if (category.improvements && Array.isArray(category.improvements)) {
                        category.improvements.forEach(improvement => {
                            improvementsHTML += `<li>${escapeHTML(improvement)}</li>`;
                        });
                    } else {
                        improvementsHTML += '<li>No specific areas for improvement identified</li>';
                    }
                    improvementsHTML += '</ul>';
                    
                    categoriesHTML += `
                        <div class="category-section">
                            <div class="category-header">
                                <h4 class="category-title">${escapeHTML(category.name)}</h4>
                                <div class="category-score ${getScoreColorClass(category.score)}">${category.score}</div>
                            </div>
                            
                            <div class="row mb-3">
                                <div class="col-md-6">
                                    <h5><i class="fas fa-check-circle text-success me-2"></i>Strengths</h5>
                                    ${strengthsHTML}
                                </div>
                                <div class="col-md-6">
                                    <h5><i class="fas fa-exclamation-circle text-danger me-2"></i>Areas for Improvement</h5>
                                    ${improvementsHTML}
                                </div>
                            </div>
                            
                            <div class="criteria-box">
                                <h5 class="mb-2"><i class="fas fa-graduation-cap me-2"></i>Scoring Criteria</h5>
                                <p>${escapeHTML(category.criteria || 'No specific criteria provided')}</p>
                            </div>
                        </div>
                    `;
                });
            } else {
                categoriesHTML = '<div class="alert alert-warning">Detailed category analysis not available</div>';
            }
            
            // Create the full analysis HTML
            return `
                <div class="analysis-result" id="analysis-${index || 0}">
                    <div class="analysis-header">
                        <div class="row">
                            <div class="col-md-8">
                                <h3>Response Analysis${index !== undefined ? ` #${index + 1}` : ''}</h3>
                                <div class="analysis-question">${escapeHTML(question)}</div>
                                <div class="analysis-response">${escapeHTML(response)}</div>
                            </div>
                            <div class="col-md-4">
                                <div class="overall-score">
                                    <div class="score-circle ${getScoreColorClass(analysis.overallScore)}">${analysis.overallScore}</div>
                                    <div class="score-label">${getScoreLabel(analysis.overallScore)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="analysis-body">
                        <div class="summary-box mb-4">
                            <h4 class="mb-2"><i class="fas fa-file-alt me-2"></i>Summary</h4>
                            <p>${escapeHTML(analysis.summary || 'No summary provided')}</p>
                        </div>
                        
                        <h4 class="mb-3"><i class="fas fa-chart-bar me-2"></i>Detailed Analysis</h4>
                        ${categoriesHTML}
                    </div>
                </div>
            `;
        }
        
        // Create HTML for error result
        function createErrorHTML(result, index) {
            return `
                <div class="analysis-result" id="analysis-${index}">
                    <div class="analysis-header bg-danger text-white">
                        <h3>Error in Analysis #${index + 1}</h3>
                    </div>
                    <div class="analysis-body">
                        <div class="alert alert-danger">
                            <h4>Analysis Failed</h4>
                            <p>${escapeHTML(result.error)}</p>
                        </div>
                        <div class="mt-3">
                            <h5>Question:</h5>
                            <p>${escapeHTML(result.question)}</p>
                            <h5>Response:</h5>
                            <p>${escapeHTML(result.response)}</p>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Show loading indicator
        function showLoading() {
            resultsContainer.innerHTML = `
                <div class="text-center p-5">
                    <div class="loading-spinner mb-3"></div>
                    <h4>Analyzing response...</h4>
                    <p>This may take up to 30 seconds</p>
                </div>
            `;
        }
        
        // Reset output
        function resetOutput() {
            resultsContainer.innerHTML = `
                <div class="welcome-screen text-center p-4">
                    <div class="display-6 mt-3 mb-4">
                        <i class="fas fa-search-plus text-primary"></i>
                    </div>
                    <h2>English Response Analysis</h2>
                    <p class="lead mb-4">Enter a response to analyze or load example data to begin.</p>
                    <div class="features-grid">
                        <div class="feature-item">
                            <div class="feature-icon text-primary">
                                <i class="fas fa-spell-check"></i>
                            </div>
                            <h4>Grammar Accuracy</h4>
                            <p>Evaluate grammatical correctness</p>
                        </div>
                        <div class="feature-item">
                            <div class="feature-icon text-primary">
                                <i class="fas fa-sitemap"></i>
                            </div>
                            <h4>Content Organization</h4>
                            <p>Assess structure and logical flow</p>
                        </div>
                        <div class="feature-item">
                            <div class="feature-icon text-primary">
                                <i class="fas fa-headphones"></i>
                            </div>
                            <h4>Listening Comprehension</h4>
                            <p>Measure question understanding</p>
                        </div>
                        <div class="feature-item">
                            <div class="feature-icon text-primary">
                                <i class="fas fa-book"></i>
                            </div>
                            <h4>Vocabulary</h4>
                            <p>Evaluate word choice and variety</p>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Reset UI
        function resetUI() {
            progressSection.style.display = 'none';
            showLoading();
        }
        
        // Validate inputs
        function validateInputs(apiKey, question, response) {
            if (!apiKey) {
                showError('API key is required');
                return false;
            }
            
            if (!question) {
                showError('Question is required');
                return false;
            }
            
            if (!response) {
                showError('Response is required');
                return false;
            }
            
            return true;
        }
        
        // Show error message
        function showError(message) {
            errorModalBody.textContent = message;
            errorModal.show();
        }
        
        // Escape HTML for safe display
        function escapeHTML(str) {
            if (!str) return '';
            return str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }
        
        // Initialize UI
        resetOutput();
    });
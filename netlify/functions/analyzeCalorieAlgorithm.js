/**
 * Netlify Scheduled Function for Calorie Algorithm Analysis and Improvement
 * 
 * This function runs daily to analyze calorie comparison data and improve the algorithm.
 * Scheduled via netlify.toml configuration.
 */

const { admin, db, convertTimestamp } = require('./config/firebase');

/**
 * Performs statistical analysis on comparison data
 */
function performAnalysis(data) {
    const percentageDifferences = data.map(d => d.percentageDifference).filter(d => d !== null);
    
    // Overall statistics
    const avgDifference = percentageDifferences.reduce((sum, diff) => sum + diff, 0) / percentageDifferences.length;
    const sortedDifferences = percentageDifferences.sort((a, b) => a - b);
    const medianDifference = sortedDifferences[Math.floor(sortedDifferences.length / 2)];
    const variance = percentageDifferences.reduce((sum, diff) => sum + Math.pow(diff - avgDifference, 2), 0) / percentageDifferences.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Category-specific analysis
    const cardioData = data.filter(d => d.exerciseCategories && d.exerciseCategories.includes('cardio'));
    const strengthData = data.filter(d => d.exerciseCategories && d.exerciseCategories.includes('weightTraining'));
    const mobilityData = data.filter(d => d.exerciseCategories && d.exerciseCategories.includes('mobility'));
    
    const cardioAnalysis = analyzeCategoryData(cardioData, 'cardio');
    const strengthAnalysis = analyzeCategoryData(strengthData, 'weightTraining');
    const mobilityAnalysis = analyzeCategoryData(mobilityData, 'mobility');
    
    // Generate recommendations
    const recommendations = {};
    
    if (cardioAnalysis.averageDifference > 5) {
        recommendations.cardio = Math.max(0.7, 1.0 - (cardioAnalysis.averageDifference / 100.0));
    }
    if (strengthAnalysis.averageDifference > 5) {
        recommendations.weightTraining = Math.max(0.7, 1.0 - (strengthAnalysis.averageDifference / 100.0));
    }
    if (mobilityAnalysis.averageDifference > 5) {
        recommendations.mobility = Math.max(0.7, 1.0 - (mobilityAnalysis.averageDifference / 100.0));
    }
    
    // Calculate confidence score
    const totalSamples = data.length;
    const consistencyScore = Math.max(0, 1.0 - (standardDeviation / 50.0));
    const sampleSizeScore = Math.min(1.0, totalSamples / 100.0);
    const confidenceScore = (consistencyScore + sampleSizeScore) / 2.0;
    
    return {
        totalComparisons: data.length,
        averagePercentageDifference: avgDifference,
        medianPercentageDifference: medianDifference,
        standardDeviation: standardDeviation,
        cardioAnalysis: cardioAnalysis,
        strengthAnalysis: strengthAnalysis,
        mobilityAnalysis: mobilityAnalysis,
        recommendedAdjustments: recommendations,
        confidenceScore: confidenceScore
    };
}

/**
 * Analyzes data for a specific exercise category
 */
function analyzeCategoryData(data, category) {
    if (data.length === 0) {
        return {
            category: category,
            sampleCount: 0,
            averageDifference: 0,
            recommendedMultiplier: 1.0,
            currentAccuracy: 0
        };
    }
    
    const differences = data.map(d => d.percentageDifference).filter(d => d !== null);
    const avgDifference = differences.reduce((sum, diff) => sum + diff, 0) / differences.length;
    
    // Calculate accuracy (percentage within 10% of Apple Watch)
    const accurateEstimates = differences.filter(diff => Math.abs(diff) <= 10).length;
    const accuracy = (accurateEstimates / differences.length) * 100;
    
    // Recommend multiplier adjustment
    let recommendedMultiplier;
    if (avgDifference > 10) {
        recommendedMultiplier = Math.max(0.7, 1.0 - (avgDifference / 100.0));
    } else if (avgDifference < -10) {
        recommendedMultiplier = Math.min(1.3, 1.0 + (Math.abs(avgDifference) / 100.0));
    } else {
        recommendedMultiplier = 1.0;
    }
    
    return {
        category: category,
        sampleCount: data.length,
        averageDifference: avgDifference,
        recommendedMultiplier: recommendedMultiplier,
        currentAccuracy: accuracy
    };
}

/**
 * Generates a human-readable analysis report
 */
function generateAnalysisReport(analysis) {
    return `
📊 CALORIE ALGORITHM ANALYSIS REPORT
=====================================

📈 Overall Performance:
• Total Comparisons: ${analysis.totalComparisons}
• Average Difference: ${analysis.averagePercentageDifference.toFixed(1)}%
• Median Difference: ${analysis.medianPercentageDifference.toFixed(1)}%
• Standard Deviation: ${analysis.standardDeviation.toFixed(1)}%
• Confidence Score: ${(analysis.confidenceScore * 100).toFixed(1)}%

🏃 Cardio Exercises:
• Sample Count: ${analysis.cardioAnalysis.sampleCount}
• Average Difference: ${analysis.cardioAnalysis.averageDifference.toFixed(1)}%
• Current Accuracy: ${analysis.cardioAnalysis.currentAccuracy.toFixed(1)}%
• Recommended Multiplier: ${analysis.cardioAnalysis.recommendedMultiplier.toFixed(2)}

🏋️ Strength Training:
• Sample Count: ${analysis.strengthAnalysis.sampleCount}
• Average Difference: ${analysis.strengthAnalysis.averageDifference.toFixed(1)}%
• Current Accuracy: ${analysis.strengthAnalysis.currentAccuracy.toFixed(1)}%
• Recommended Multiplier: ${analysis.strengthAnalysis.recommendedMultiplier.toFixed(2)}

🧘 Mobility/Recovery:
• Sample Count: ${analysis.mobilityAnalysis.sampleCount}
• Average Difference: ${analysis.mobilityAnalysis.averageDifference.toFixed(1)}%
• Current Accuracy: ${analysis.mobilityAnalysis.currentAccuracy.toFixed(1)}%
• Recommended Multiplier: ${analysis.mobilityAnalysis.recommendedMultiplier.toFixed(2)}

🎯 Recommendations:
${Object.keys(analysis.recommendedAdjustments).length === 0 ? 
    '• No adjustments needed' : 
    Object.entries(analysis.recommendedAdjustments)
        .map(([key, value]) => `• ${key}: ${value.toFixed(2)}x`)
        .join('\n')
}
    `;
}

/**
 * Core analysis logic
 */
async function analyzeCalorieAlgorithm() {
    console.log('Starting calorie algorithm analysis...');
    
    // Check Firebase connection
    if (!admin || !db || admin.apps.length === 0) {
        throw new Error('Firebase Admin SDK not initialized');
    }
    
    // Fetch comparison data from the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoTimestamp = thirtyDaysAgo.getTime() / 1000;
    
    const comparisonSnapshot = await db.collection('calorie_comparison_data')
        .where('timestamp', '>=', thirtyDaysAgoTimestamp)
        .orderBy('timestamp', 'desc')
        .limit(1000)
        .get();
    
    if (comparisonSnapshot.empty) {
        console.log('No comparison data found for analysis');
        return { success: true, message: 'No data available for analysis' };
    }
    
    const comparisonData = comparisonSnapshot.docs.map(doc => doc.data());
    
    // Filter data to only include comparisons with Apple Watch data
    const validComparisons = comparisonData.filter(data => 
        data.appleWatchCalories !== null && 
        data.appleWatchCalories !== undefined &&
        data.percentageDifference !== null &&
        data.percentageDifference !== undefined
    );
    
    if (validComparisons.length < 10) {
        console.log(`Insufficient data for analysis. Need at least 10 comparisons, have ${validComparisons.length}`);
        return { success: true, message: `Insufficient data: ${validComparisons.length} comparisons` };
    }
    
    console.log(`Analyzing ${validComparisons.length} valid comparisons...`);
    
    // Perform analysis
    const analysis = performAnalysis(validComparisons);
    
    // Store analysis results
    await db.collection('calorie_analysis_results')
        .doc('latest')
        .set({
            ...analysis,
            analysisDate: admin.firestore.FieldValue.serverTimestamp()
        });
    
    console.log('Analysis results stored');
    
    // Apply adjustments if confidence is high enough
    if (analysis.confidenceScore > 0.6) {
        const adjustments = {
            cardio_multiplier: analysis.cardioAnalysis.recommendedMultiplier,
            strength_multiplier: analysis.strengthAnalysis.recommendedMultiplier,
            mobility_multiplier: analysis.mobilityAnalysis.recommendedMultiplier,
            last_updated: admin.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('algorithm_settings')
            .doc('calorie_multipliers')
            .set(adjustments);
        
        console.log('Algorithm adjustments applied:', adjustments);
        
        // Log the analysis report
        const report = generateAnalysisReport(analysis);
        console.log('Analysis Report:\n', report);
        
    } else {
        console.log(`Confidence score too low (${analysis.confidenceScore}) to apply adjustments`);
    }
    
    return { 
        success: true, 
        analysis,
        adjustmentsApplied: analysis.confidenceScore > 0.6
    };
}

exports.handler = async (event) => {
    console.log("Netlify function 'analyzeCalorieAlgorithm' triggered.");
    
    // Check if this is a scheduled execution
    const source = event.headers?.['x-netlify-event-source'] || 'manual';
    console.log(`Calorie algorithm analysis triggered via ${source}.`);
    
    try {
        const result = await analyzeCalorieAlgorithm();
        
        console.log("Calorie algorithm analysis completed.", JSON.stringify(result, null, 2));
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: true,
                message: 'Calorie algorithm analysis completed successfully.',
                result
            })
        };
    } catch (error) {
        console.error('Error in analyzeCalorieAlgorithm Netlify function:', error.message, error.stack);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: false,
                error: error.message || 'Internal server error.',
                timestamp: new Date().toISOString()
            })
        };
    }
}; 
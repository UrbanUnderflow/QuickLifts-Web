/**
 * Manual trigger for Calorie Algorithm Analysis
 * 
 * This function allows manual triggering of the calorie analysis for testing purposes.
 * It includes the same core logic as the scheduled function.
 */

const { admin, db, headers } = require('./config/firebase');

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
 * Core analysis logic
 */
async function analyzeCalorieAlgorithm() {
    console.log('Starting calorie algorithm analysis...');
    
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
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    console.log("Manual trigger for calorie algorithm analysis called.");

    // Check Firebase connection
    if (!admin || !db || admin.apps.length === 0) {
        console.error("Firebase Admin SDK not initialized or db not available from config. Exiting.");
        return {
            statusCode: 500,
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                success: false, 
                error: "Firebase Admin SDK not initialized or not available from config." 
            }),
        };
    }

    try {
        console.log("Manually triggering calorie algorithm analysis...");
        
        const result = await analyzeCalorieAlgorithm();
        
        console.log("Manual calorie analysis completed successfully:", JSON.stringify(result, null, 2));
        
        return {
            statusCode: 200,
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: true,
                message: 'Calorie algorithm analysis triggered manually and completed successfully.',
                result,
                triggeredAt: new Date().toISOString()
            })
        };
    } catch (error) {
        console.error('Error in manual calorie analysis trigger:', error.message, error.stack);
        
        return {
            statusCode: 500,
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: false,
                error: error.message || 'Internal server error during manual trigger.',
                timestamp: new Date().toISOString()
            })
        };
    }
}; 
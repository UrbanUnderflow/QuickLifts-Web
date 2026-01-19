/**
 * Mental Curriculum Notifications
 * 
 * Firebase Cloud Functions for mental training curriculum notifications:
 * - New assignment notifications
 * - Daily reminder notifications
 * - Day 7/14 checkpoint notifications
 * - Mastery achievement notifications
 */

const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const { sendNotificationWithLogging, logMulticastNotification } = require('./notificationLogger');

const db = admin.firestore();
const messaging = admin.messaging();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current day number in an assignment
 */
function getDayNumber(startDate) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffTime = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

/**
 * Send notification to a single user
 */
async function sendNotificationToUser(userId, title, body, dataPayload = {}, notificationType = 'MENTAL_TRAINING') {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      console.log(`User ${userId} not found`);
      return { success: false, reason: 'user_not_found' };
    }

    const fcmToken = userDoc.data().fcmToken;
    if (!fcmToken) {
      console.log(`User ${userId} has no FCM token`);
      return { success: false, reason: 'no_token' };
    }

    const message = {
      token: fcmToken,
      notification: { title, body },
      data: {
        ...dataPayload,
        type: notificationType,
        timestamp: String(Math.floor(Date.now() / 1000))
      },
      apns: {
        payload: {
          aps: {
            alert: { title, body },
            badge: 1,
            sound: 'default'
          },
        },
      },
      android: {
        priority: 'high',
        notification: { sound: 'default' }
      }
    };

    const response = await messaging.send(message);
    console.log(`Sent ${notificationType} notification to ${userId}: ${response}`);
    return { success: true, messageId: response };
  } catch (error) {
    console.error(`Error sending notification to ${userId}:`, error);
    return { success: false, reason: error.message };
  }
}

/**
 * Get user display name
 */
async function getUserDisplayName(userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      return data.displayName || data.username || 'Athlete';
    }
  } catch (error) {
    console.error(`Error getting user ${userId} name:`, error);
  }
  return 'Athlete';
}

// ============================================================================
// FIRESTORE TRIGGERS
// ============================================================================

/**
 * Trigger: When a new curriculum assignment is created
 * Sends notification to the athlete about their new assignment
 */
exports.onCurriculumAssignmentCreated = onDocumentCreated(
  "mental-curriculum-assignments/{assignmentId}",
  async (event) => {
    const snap = event.data;
    if (!snap) {
      console.log('No data associated with the assignment creation event');
      return null;
    }

    const assignmentData = snap.data();
    const assignmentId = event.params.assignmentId;

    const { athleteId, exerciseId, coachId, coachNote, pathway } = assignmentData;

    if (!athleteId || !exerciseId) {
      console.error('Missing athleteId or exerciseId in assignment');
      return null;
    }

    console.log(`New curriculum assignment ${assignmentId} created for athlete ${athleteId}`);

    // Get exercise name
    let exerciseName = 'mental exercise';
    try {
      if (assignmentData.exercise?.name) {
        exerciseName = assignmentData.exercise.name;
      } else {
        const exerciseDoc = await db.collection('mental-exercises').doc(exerciseId).get();
        if (exerciseDoc.exists) {
          exerciseName = exerciseDoc.data().name || 'mental exercise';
        }
      }
    } catch (error) {
      console.error('Error fetching exercise:', error);
    }

    // Get coach name
    let coachName = 'Your coach';
    if (coachId) {
      try {
        const coachDoc = await db.collection('users').doc(coachId).get();
        if (coachDoc.exists) {
          const coachData = coachDoc.data();
          coachName = coachData.displayName || coachData.username || 'Your coach';
        }
      } catch (error) {
        console.error('Error fetching coach:', error);
      }
    }

    // Send notification to athlete
    const title = '🧠 New Mental Training Assignment';
    const body = `${coachName} assigned: ${exerciseName}. Start your 14-day journey to mastery!`;
    
    const dataPayload = {
      assignmentId,
      exerciseId,
      exerciseName,
      pathway: pathway || 'foundation'
    };

    await sendNotificationToUser(athleteId, title, body, dataPayload, 'MENTAL_ASSIGNMENT');

    // Update athlete-mental-progress with active assignment
    try {
      await db.collection('athlete-mental-progress').doc(athleteId).set({
        activeAssignmentId: assignmentId,
        activeAssignmentExerciseName: exerciseName,
        updatedAt: Date.now()
      }, { merge: true });
    } catch (error) {
      console.error('Error updating athlete progress:', error);
    }

    return null;
  }
);

/**
 * Trigger: When a curriculum assignment is updated
 * Handles mastery achievement and extension notifications
 */
exports.onCurriculumAssignmentUpdated = onDocumentUpdated(
  "mental-curriculum-assignments/{assignmentId}",
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    
    if (!before || !after) {
      console.log('Missing before/after data in assignment update');
      return null;
    }

    const assignmentId = event.params.assignmentId;
    const { athleteId, coachId } = after;

    // Check for status changes
    const statusChanged = before.status !== after.status;
    
    if (!statusChanged) {
      return null;
    }

    console.log(`Assignment ${assignmentId} status changed: ${before.status} -> ${after.status}`);

    const exerciseName = after.exercise?.name || 'the exercise';
    const athleteName = await getUserDisplayName(athleteId);

    // Handle different status transitions
    if (after.status === 'completed' && after.masteryAchieved) {
      // Mastery achieved - notify athlete
      const athleteTitle = '🏆 Exercise Mastered!';
      const athleteBody = `Congratulations! You've mastered ${exerciseName}. A new assignment is on its way!`;
      await sendNotificationToUser(athleteId, athleteTitle, athleteBody, { assignmentId }, 'MENTAL_MASTERY');

      // Notify coach
      if (coachId) {
        const coachTitle = '⭐ Athlete Mastered Exercise';
        const coachBody = `${athleteName} completed ${exerciseName} with ${after.completionRate}% completion. Ready for next assignment.`;
        await sendNotificationToUser(coachId, coachTitle, coachBody, { assignmentId, athleteId }, 'MENTAL_MASTERY_COACH');
      }

      // Clear active assignment from progress
      try {
        await db.collection('athlete-mental-progress').doc(athleteId).update({
          activeAssignmentId: admin.firestore.FieldValue.delete(),
          activeAssignmentExerciseName: admin.firestore.FieldValue.delete(),
          totalAssignmentsCompleted: admin.firestore.FieldValue.increment(1),
          totalExercisesMastered: admin.firestore.FieldValue.increment(1),
          pathwayStep: admin.firestore.FieldValue.increment(1),
          updatedAt: Date.now()
        });
      } catch (error) {
        console.error('Error updating athlete progress after mastery:', error);
      }

    } else if (after.status === 'completed' && !after.masteryAchieved) {
      // Completed but not mastered
      const athleteTitle = '✅ Assignment Complete';
      const athleteBody = `You finished ${exerciseName}. Keep practicing to build these skills!`;
      await sendNotificationToUser(athleteId, athleteTitle, athleteBody, { assignmentId }, 'MENTAL_COMPLETE');

      // Notify coach
      if (coachId) {
        const coachTitle = '📋 Assignment Finished';
        const coachBody = `${athleteName} completed ${exerciseName} with ${after.completionRate}% (below mastery threshold).`;
        await sendNotificationToUser(coachId, coachTitle, coachBody, { assignmentId, athleteId }, 'MENTAL_COMPLETE_COACH');
      }

      // Clear active assignment
      try {
        await db.collection('athlete-mental-progress').doc(athleteId).update({
          activeAssignmentId: admin.firestore.FieldValue.delete(),
          activeAssignmentExerciseName: admin.firestore.FieldValue.delete(),
          totalAssignmentsCompleted: admin.firestore.FieldValue.increment(1),
          updatedAt: Date.now()
        });
      } catch (error) {
        console.error('Error updating athlete progress after completion:', error);
      }

    } else if (after.status === 'extended') {
      // Assignment extended
      const athleteTitle = '📅 Assignment Extended';
      const athleteBody = `Your ${exerciseName} practice has been extended by 7 days. Keep going!`;
      await sendNotificationToUser(athleteId, athleteTitle, athleteBody, { assignmentId }, 'MENTAL_EXTENDED');

      // Notify coach
      if (coachId) {
        const coachTitle = '⏰ Assignment Auto-Extended';
        const coachBody = `${athleteName}'s ${exerciseName} was extended (${after.completionRate}% completion).`;
        await sendNotificationToUser(coachId, coachTitle, coachBody, { assignmentId, athleteId }, 'MENTAL_EXTENDED_COACH');
      }
    }

    return null;
  }
);

// ============================================================================
// SCHEDULED FUNCTIONS
// ============================================================================

/**
 * Scheduled: Daily reminder notifications
 * Runs every day at 8:00 AM and 8:00 PM to remind athletes of their assignments
 * 
 * Note: Deploy with: firebase deploy --only functions:scheduledDailyReminder
 */
exports.scheduledDailyReminder = onSchedule(
  {
    schedule: "0 8,20 * * *", // 8am and 8pm daily
    timeZone: "America/New_York",
  },
  async (event) => {
    console.log('Running scheduled daily reminder check');

    const now = Date.now();
    const today = formatDate(now);
    const currentHour = new Date().getHours();
    const isEvening = currentHour >= 18;

    try {
      // Get all active/extended assignments
      const assignmentsSnapshot = await db.collection('mental-curriculum-assignments')
        .where('status', 'in', ['active', 'extended'])
        .get();

      if (assignmentsSnapshot.empty) {
        console.log('No active assignments found');
        return null;
      }

      console.log(`Found ${assignmentsSnapshot.size} active assignments`);

      for (const doc of assignmentsSnapshot.docs) {
        const assignment = doc.data();
        const assignmentId = doc.id;
        const { athleteId, exerciseId, reminderEnabled, startDate, targetDays } = assignment;

        // Skip if reminders are disabled
        if (!reminderEnabled) {
          continue;
        }

        // Check if today's practice is already completed
        const dailyCompletionRef = db.collection('mental-curriculum-assignments')
          .doc(assignmentId)
          .collection('daily-completions')
          .doc(today);
        
        const dailyCompletion = await dailyCompletionRef.get();
        const isCompleted = dailyCompletion.exists && dailyCompletion.data()?.completed;

        // Get day number
        const dayNumber = getDayNumber(startDate);
        const exerciseName = assignment.exercise?.name || 'your exercise';

        if (isEvening && !isCompleted) {
          // Evening incomplete reminder
          const title = '🌙 Don\'t forget tonight!';
          const body = `You haven't done ${exerciseName} today. Just 1-2 minutes before bed?`;
          await sendNotificationToUser(athleteId, title, body, { assignmentId }, 'MENTAL_EVENING_REMINDER');
        } else if (!isEvening && !isCompleted) {
          // Morning reminder
          const title = '☀️ Good Morning!';
          const body = `Time for ${exerciseName}. Day ${dayNumber} of ${targetDays}.`;
          await sendNotificationToUser(athleteId, title, body, { assignmentId }, 'MENTAL_MORNING_REMINDER');
        }
      }

    } catch (error) {
      console.error('Error in daily reminder:', error);
    }

    return null;
  }
);

/**
 * Scheduled: Day 7 and Day 14 checkpoint check
 * Runs daily at midnight to check for checkpoint milestones
 */
exports.scheduledCheckpoints = onSchedule(
  {
    schedule: "0 0 * * *", // Midnight daily
    timeZone: "America/New_York",
  },
  async (event) => {
    console.log('Running scheduled checkpoint check');

    try {
      const assignmentsSnapshot = await db.collection('mental-curriculum-assignments')
        .where('status', 'in', ['active', 'extended'])
        .get();

      if (assignmentsSnapshot.empty) {
        console.log('No active assignments for checkpoint check');
        return null;
      }

      for (const doc of assignmentsSnapshot.docs) {
        const assignment = doc.data();
        const assignmentId = doc.id;
        const { athleteId, coachId, startDate, completionRate, targetDays, extendedCount } = assignment;

        const dayNumber = getDayNumber(startDate);
        const exerciseName = assignment.exercise?.name || 'the exercise';
        const athleteName = await getUserDisplayName(athleteId);

        // Day 7 checkpoint
        if (dayNumber === 7) {
          console.log(`Day 7 checkpoint for assignment ${assignmentId}`);

          // Notify athlete
          const athleteTitle = '📊 Halfway Check-in!';
          const athleteBody = `You're halfway through ${exerciseName}! ${completionRate}% complete so far.`;
          await sendNotificationToUser(athleteId, athleteTitle, athleteBody, { assignmentId }, 'MENTAL_CHECKPOINT_7');

          // Alert coach if below 60%
          if (coachId && completionRate < 60) {
            const coachTitle = '⚠️ Athlete Needs Check-in';
            const coachBody = `${athleteName} at ${completionRate}% halfway through ${exerciseName}. Consider reaching out.`;
            await sendNotificationToUser(coachId, coachTitle, coachBody, { assignmentId, athleteId }, 'MENTAL_CHECKPOINT_7_COACH');
          }
        }

        // Day 14 checkpoint (or day 21 if extended, etc.)
        if (dayNumber >= targetDays) {
          console.log(`End of cycle checkpoint for assignment ${assignmentId}, day ${dayNumber}`);

          // Determine if mastery achieved (80%+)
          if (completionRate >= 80) {
            // Mastery - update status
            await db.collection('mental-curriculum-assignments').doc(assignmentId).update({
              status: 'completed',
              masteryAchieved: true,
              updatedAt: Date.now()
            });
            // onCurriculumAssignmentUpdated will handle notifications
          } else if (completionRate >= 60 && extendedCount < 2) {
            // Extend by 7 days
            const newEndDate = Date.now() + (7 * 24 * 60 * 60 * 1000);
            await db.collection('mental-curriculum-assignments').doc(assignmentId).update({
              status: 'extended',
              endDate: newEndDate,
              targetDays: targetDays + 7,
              extendedCount: (extendedCount || 0) + 1,
              updatedAt: Date.now()
            });
            // onCurriculumAssignmentUpdated will handle notifications
          } else {
            // Complete without mastery
            await db.collection('mental-curriculum-assignments').doc(assignmentId).update({
              status: 'completed',
              masteryAchieved: false,
              updatedAt: Date.now()
            });
            // onCurriculumAssignmentUpdated will handle notifications
          }
        }
      }

    } catch (error) {
      console.error('Error in checkpoint check:', error);
    }

    return null;
  }
);

/**
 * HTTP Trigger: Manually generate recommendations for a coach's athletes
 * Used when coach clicks "Generate Recommendations" button
 */
exports.generateRecommendations = require("firebase-functions/v2/https").onCall(
  async (request) => {
    const { coachId, athleteIds } = request.data;

    if (!coachId) {
      throw new Error('coachId is required');
    }

    console.log(`Generating recommendations for coach ${coachId}, athletes: ${athleteIds?.join(', ') || 'all'}`);

    // This would integrate with the recommendation service logic
    // For now, just log and return success
    // The actual recommendation generation happens client-side via the recommendationService

    return {
      success: true,
      message: 'Recommendations generation triggered'
    };
  }
);

// ============================================================================
// ATHLETE SELF-ASSIGNMENT NOTIFICATIONS
// ============================================================================

/**
 * Triggered when athlete self-assigns a mental exercise
 * Sends push notification and email to the coach
 */
exports.onAthleteSelfAssignment = onDocumentCreated(
  'coach-notifications/{notificationId}',
  async (event) => {
    const notification = event.data?.data();
    if (!notification) {
      console.log('No notification data found');
      return null;
    }

    // Only handle athlete_self_assignment type
    if (notification.type !== 'athlete_self_assignment') {
      return null;
    }

    const { coachId, athleteId, exerciseName, assignmentId } = notification;
    console.log(`Athlete ${athleteId} self-assigned ${exerciseName}`);

    try {
      // Get athlete name
      const athleteName = await getUserDisplayName(athleteId);
      
      // Get coach info for email
      const coachDoc = await db.collection('users').doc(coachId).get();
      const coachData = coachDoc.exists ? coachDoc.data() : null;

      // 1. Send Push Notification to Coach
      const pushTitle = '🧠 Athlete Started Mental Training';
      const pushBody = `${athleteName} started "${exerciseName}" from your recommendations.`;
      
      await sendNotificationToUser(
        coachId,
        pushTitle,
        pushBody,
        {
          assignmentId,
          athleteId,
          exerciseName,
          action: 'view_assignment'
        },
        'ATHLETE_SELF_ASSIGNMENT'
      );
      console.log(`Push notification sent to coach ${coachId}`);

      // 2. Send Email to Coach (if email is available)
      if (coachData?.email) {
        await sendSelfAssignmentEmail(
          coachData.email,
          coachData.fullName || coachData.displayName || 'Coach',
          athleteName,
          exerciseName,
          assignmentId
        );
        console.log(`Email sent to coach ${coachData.email}`);
      }

      // 3. Mark notification as processed
      await event.data.ref.update({
        processed: true,
        processedAt: Date.now()
      });

      return { success: true };
    } catch (error) {
      console.error('Error processing athlete self-assignment notification:', error);
      return { success: false, error: error.message };
    }
  }
);

/**
 * Send email notification to coach about athlete self-assignment
 * Uses a simple transactional email approach
 */
async function sendSelfAssignmentEmail(toEmail, coachName, athleteName, exerciseName, assignmentId) {
  try {
    // Store email request in Firestore for processing by email service
    // This can be picked up by a separate email sending function or service
    const emailDoc = {
      to: toEmail,
      template: 'athlete_self_assignment',
      data: {
        coachName,
        athleteName,
        exerciseName,
        assignmentId,
        dashboardUrl: `https://fitwithpulse.ai/coach/mentalGames?tab=assignments`
      },
      createdAt: Date.now(),
      processed: false
    };

    await db.collection('email-queue').add(emailDoc);
    console.log(`Email queued for ${toEmail}`);

    // If you have SendGrid, Mailgun, or similar, you could send directly:
    // await sendgrid.send({
    //   to: toEmail,
    //   from: 'nora@fitwithpulse.ai',
    //   subject: `${athleteName} started a mental training exercise`,
    //   html: `...`
    // });

    return true;
  } catch (error) {
    console.error('Error queueing email:', error);
    return false;
  }
}

/**
 * Process email queue - can be triggered by scheduler or called directly
 * This is a placeholder for actual email sending implementation
 */
exports.processEmailQueue = onSchedule(
  {
    schedule: 'every 5 minutes',
    region: 'us-central1',
    timeZone: 'America/New_York',
  },
  async (event) => {
    try {
      // Get unprocessed emails
      const emailsSnapshot = await db.collection('email-queue')
        .where('processed', '==', false)
        .limit(50)
        .get();

      if (emailsSnapshot.empty) {
        return null;
      }

      console.log(`Processing ${emailsSnapshot.size} queued emails`);

      for (const doc of emailsSnapshot.docs) {
        const emailData = doc.data();

        // TODO: Integrate with your email provider (SendGrid, Mailgun, etc.)
        // For now, just mark as processed with a note

        if (emailData.template === 'athlete_self_assignment') {
          // Construct email content
          const { coachName, athleteName, exerciseName, dashboardUrl } = emailData.data;
          
          console.log(`Would send email to ${emailData.to}:`);
          console.log(`Subject: ${athleteName} started a mental training exercise`);
          console.log(`Body: Hey ${coachName}! ${athleteName} just started "${exerciseName}" from Nora's recommendations.`);
          console.log(`CTA: View their progress at ${dashboardUrl}`);

          // Mark as processed (in production, mark after successful send)
          await doc.ref.update({
            processed: true,
            processedAt: Date.now(),
            note: 'Email service not configured - logged only'
          });
        }
      }

      return null;
    } catch (error) {
      console.error('Error processing email queue:', error);
      return null;
    }
  }
);

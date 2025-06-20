import { NextApiRequest, NextApiResponse } from 'next';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../api/firebase/config';

interface SaveAdminSettingsRequest {
  emailTemplate?: string;
  // Add other admin settings here as needed
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { emailTemplate } = req.body as SaveAdminSettingsRequest;

    if (!emailTemplate?.trim()) {
      return res.status(400).json({ error: 'Email template is required' });
    }

    // Use a fixed document ID for admin settings
    const settingsRef = doc(db, 'admin-settings', 'email-outreach');
    
    // Get existing settings to merge with new ones
    let existingSettings = {};
    try {
      const existingDoc = await getDoc(settingsRef);
      if (existingDoc.exists()) {
        existingSettings = existingDoc.data();
      }
    } catch (error) {
      console.log('No existing settings found, creating new document');
    }

    // Merge existing settings with new email template
    const updatedSettings = {
      ...existingSettings,
      emailTemplate: emailTemplate.trim(),
      updatedAt: new Date(),
      lastUpdatedBy: 'admin' // You could pass user info here if needed
    };

    await setDoc(settingsRef, updatedSettings);
    
    console.log('✅ Admin settings saved successfully');

    return res.status(200).json({ 
      success: true,
      message: 'Email template saved successfully'
    });

  } catch (error) {
    console.error('Error saving admin settings:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal Server Error',
      success: false 
    });
  }
} 
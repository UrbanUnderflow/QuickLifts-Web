import { NextApiRequest, NextApiResponse } from 'next';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../api/firebase/config';

interface AdminSettings {
  emailTemplate?: string;
  updatedAt?: any;
  lastUpdatedBy?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Get admin settings from Firebase
    const settingsRef = doc(db, 'admin-settings', 'email-outreach');
    const settingsDoc = await getDoc(settingsRef);
    
    if (!settingsDoc.exists()) {
      // Return empty settings if none exist yet
      return res.status(200).json({ 
        success: true,
        settings: {
          emailTemplate: ''
        }
      });
    }

    const settings = settingsDoc.data() as AdminSettings;
    
    console.log('📖 Admin settings loaded successfully');

    return res.status(200).json({ 
      success: true,
      settings: {
        emailTemplate: settings.emailTemplate || '',
        lastUpdated: settings.updatedAt?.toDate?.() || null,
        lastUpdatedBy: settings.lastUpdatedBy || 'unknown'
      }
    });

  } catch (error) {
    console.error('Error loading admin settings:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal Server Error',
      success: false 
    });
  }
} 
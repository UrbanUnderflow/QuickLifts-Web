import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../api/firebase/config';
import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const accessData = req.body;

    // Validate required fields
    if (!accessData.email || !accessData.userId) {
      return res.status(400).json({ error: 'Email and userId are required' });
    }

    // Check if user already has programming access
    const accessQuery = query(
      collection(db, 'programming-access'),
      where('email', '==', accessData.email.toLowerCase())
    );
    const existingSnapshot = await getDocs(accessQuery);

    if (!existingSnapshot.empty) {
      // Update existing record to active if it exists
      const existingDoc = existingSnapshot.docs[0];
      const existingData = existingDoc.data();

      if (existingData.status === 'active') {
        return res.status(200).json({ 
          success: true, 
          message: 'User already has active programming access',
          alreadyExists: true 
        });
      }

      // Update existing record to active
      await updateDoc(doc(db, 'programming-access', existingDoc.id), {
        status: 'active',
        approvedAt: serverTimestamp(),
        approvedBy: accessData.approvedBy || 'invite-system',
        updatedAt: serverTimestamp(),
        // Preserve existing data but update key fields
        userId: accessData.userId,
        username: accessData.username,
        name: accessData.name,
      });

      console.log(`✅ Updated existing programming access for ${accessData.email} to active`);
      return res.status(200).json({ 
        success: true, 
        message: 'Programming access activated',
        updated: true 
      });
    }

    // Create new programming access record
    const programmingAccessData = {
      email: accessData.email.toLowerCase(),
      username: accessData.username || accessData.name || accessData.email,
      userId: accessData.userId,
      name: accessData.name || accessData.username || 'Unknown',
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      approvedAt: serverTimestamp(),
      approvedBy: accessData.approvedBy || 'invite-system',
      // Default values for invite-based access
      role: accessData.role || {
        trainer: false,
        enthusiast: true,
        coach: false,
        fitnessInstructor: false,
      },
      primaryUse: accessData.primaryUse || 'Personal fitness',
      useCases: accessData.useCases || {
        oneOnOneCoaching: false,
        communityRounds: true,
        personalPrograms: true,
      },
      // Optional fields with defaults
      clientCount: accessData.clientCount || 'N/A',
      yearsExperience: accessData.yearsExperience || 'N/A',
      longTermGoal: accessData.longTermGoal || 'Improve personal fitness',
      isCertified: accessData.isCertified || false,
      certificationName: accessData.certificationName || '',
      applyForFoundingCoaches: accessData.applyForFoundingCoaches || false,
    };

    // Add to programming-access collection
    const docRef = await addDoc(collection(db, 'programming-access'), programmingAccessData);

    console.log(`✅ Programming access granted to ${accessData.email} (Doc ID: ${docRef.id})`);

    return res.status(201).json({ 
      success: true, 
      message: 'Programming access granted successfully',
      id: docRef.id,
      created: true
    });

  } catch (error) {
    console.error('Error granting programming access:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 
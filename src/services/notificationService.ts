import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Notification } from '../types';

export const sendNotification = async (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      ...notification,
      read: false,
      createdAt: Date.now()
    });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

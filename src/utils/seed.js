import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, setDoc, doc } from 'firebase/firestore';

export const seedTestData = async (uid) => {
  try {
    // ----------------------------------------------------
    // Thread 1: 3-Variable Continuous Data
    // ----------------------------------------------------
    const t1Ref = await addDoc(collection(db, `users/${uid}/chains`), {
      name: "Productivity Ecosystem",
      createdAt: serverTimestamp(),
      variables: [
        { name: 'Deep Work', typeId: 'hours', icon: '🧠', unit: 'hrs' },
        { name: 'Caffeine', typeId: 'cups', icon: '☕', unit: 'cups' },
        { name: 'Sleep Score', typeId: 'score', icon: '😴', unit: '%' }
      ]
    });

    const today = new Date();
    
    // Generate 14 days of mock data for Thread 1
    for (let i = 14; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateString = d.toLocaleDateString('en-CA'); // YYYY-MM-DD

      const cups = Math.floor(Math.random() * 5); // 0 to 4
      const sleepBase = 90 - (cups * 10) + (Math.random() * 10 - 5);
      
      let deepWork;
      if (cups === 0) deepWork = 2 + Math.random();
      else if (cups <= 2) deepWork = 4 + Math.random() * 2;
      else deepWork = 3 + Math.random(); 

      await addDoc(collection(db, `users/${uid}/chains/${t1Ref.id}/logs`), {
        dateString,
        createdAt: d,
        values: [parseFloat(deepWork.toFixed(1)), cups, Math.round(sleepBase)]
      });
    }

    // ----------------------------------------------------
    // Thread 2: Yes/No (Boolean) Data
    // ----------------------------------------------------
    const t2Ref = await addDoc(collection(db, `users/${uid}/chains`), {
      name: "Exercise Impact",
      createdAt: serverTimestamp(),
      variables: [
        { name: 'Morning Run', typeId: 'boolean', icon: '🏃‍♂️', unit: 'bool' },
        { name: 'Energy Level', typeId: 'score', icon: '🔋', unit: '/10' }
      ]
    });

    // Generate 14 days of mock data for Thread 2
    for (let i = 14; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateString = d.toLocaleDateString('en-CA');

      const ran = Math.random() > 0.5 ? 1 : 0; // 1 = Yes, 0 = No
      const energy = ran === 1 
        ? Math.floor(Math.random() * 3) + 8 // 8 to 10
        : Math.floor(Math.random() * 4) + 4; // 4 to 7

      await addDoc(collection(db, `users/${uid}/chains/${t2Ref.id}/logs`), {
        dateString,
        createdAt: d,
        values: [ran, energy]
      });
    }

    alert('Successfully seeded both "Productivity" and "Exercise Impact" (Yes/No) data! Refreshing...');
    window.location.reload();
  } catch (err) {
    console.error("Error seeding data:", err);
    alert('Failed to seed data. Check console.');
  }
};

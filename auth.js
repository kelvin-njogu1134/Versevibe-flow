
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut,
    onAuthStateChanged as onAuthStateChangedFirebase
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";


const firebaseConfig = {
    apiKey: "AIzaSyAkfJl2xQtTN7Ukm4HU0d4qt2gohixvagQ",
    authDomain: "versevibeauth.firebaseapp.com",
    projectId: "versevibeauth",
    storageBucket: "versevibeauth.firebasestorage.app",
    messagingSenderId: "226274481716",
    appId: "1:226274481716:web:29cac22674389cbc951c61"
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);


//  ADMIN CREDENTIALS (hardcoded)

const ADMIN_EMAIL = "esthernjeri1824@gmail.com";
const ADMIN_PASSWORD = "admin@njeri1824";




export async function signUpUser(email, password) {
    if (email === ADMIN_EMAIL) {
        throw new Error("This email is reserved. Please use another email.");
    }
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
}


export async function loginUser(email, password) {
    const isAdminAttempt = (email === ADMIN_EMAIL && password === ADMIN_PASSWORD);

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        
        if (isAdminAttempt && error.code === 'auth/user-not-found') {
            await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
            
            const userCredential = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
            return userCredential.user;
        }
        
        throw error;
    }
}


export async function logoutUser() {
    await signOut(auth);
}


export function onAuthStateChanged(callback) {
    return onAuthStateChangedFirebase(auth, callback);
}


export function isAdminUser(user) {
    return user && user.email === ADMIN_EMAIL;
}


export function redirectIfAuthenticated(user) {
    if (!user) return;
    if (isAdminUser(user)) {
        window.location.href = 'admin.html';
    } else {
        window.location.href = 'public.html';
    }
}


export function getCurrentUser() {
    return auth.currentUser;
}
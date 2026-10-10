



import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";



const SUPABASE_URL = 'https://dpaytuqsagpnrqtdelbi.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_AXf0SS7gtt37s1pPsM3nYA_dd1MvxGP';

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);



const ADMIN_EMAIL = 'esternjerimuraya@gmail.com';




export async function signUpUser(email, password) {

 
    
    if (email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        throw new Error(
            "This email is reserved. Please use another email."
        );
    }

    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password
    });

    if (error) {
        throw error;
    }

    return data.user;
}




export async function loginUser(email, password) {

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        throw error;
    }

    return data.user;
}




export async function logoutUser() {

    const { error } = await supabase.auth.signOut();

    if (error) {
        throw error;
    }
}




export function onAuthStateChanged(callback) {

    const {
        data: { subscription }
    } = supabase.auth.onAuthStateChange(
        (event, session) => {

            const user = session?.user ?? null;

            callback(user);
        }
    );

    
    
    return () => {
        subscription.unsubscribe();
    };
}




export function isAdminUser(user) {
    // This is for UI routing only; authorization is enforced by public.is_admin() through RLS.
    return user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}




export function redirectIfAuthenticated(user) {

    if (!user) {
        return;
    }

    if (isAdminUser(user)) {

        window.location.href = "admin.html";

    } else {

        window.location.href = "public.html";

    }
}




export async function getCurrentUser() {

    const {
        data: { user },
        error
    } = await supabase.auth.getUser();

    if (error) {
        throw error;
    }

    return user;
}




export async function getCurrentSession() {

    const {
        data: { session },
        error
    } = await supabase.auth.getSession();

    if (error) {
        return null;
    }

    return session;
}




export async function isAuthenticated() {

    const session = await getCurrentSession();

    return !!session;
}

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDQwp1thjE1L-GJQhRM8xANklVQ_47c91s",
  authDomain: "medicinal-herbs-identification.firebaseapp.com",
  projectId: "medicinal-herbs-identification",
  storageBucket: "medicinal-herbs-identification.appspot.com", // Fixed storage bucket URL
  messagingSenderId: "475932804957",
  appId: "1:475932804957:web:d9c4a15061ec2560de8ab4",
  measurementId: "G-4Z2VE3HDV1"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();

// Display error message
function showError(message, field = null) {
  // Clear all field errors first
  const fieldErrors = document.querySelectorAll('.field-error');
  fieldErrors.forEach(el => el.textContent = '');
  
  // Clear main error message
  const errorElement = document.getElementById('error-message');
  if (errorElement) {
    errorElement.textContent = '';
    errorElement.style.display = 'none';
  }
  
  // Set default message if none provided
  let displayMessage = 'Enter proper credentials.';
  
  if (message) {
    // Handle common Firebase auth errors with user-friendly messages
    if (message.includes('auth/wrong-password')) {
      displayMessage = 'Enter correct password.';
      field = 'password';
    } else if (message.includes('auth/user-not-found')) {
      displayMessage = 'This email doesn\'t exist. First you have to sign up.';
      field = 'email';
    } else if (message.includes('auth/email-already-in-use')) {
      displayMessage = 'Email already exists.';
      field = 'email';
    } else if (message.includes('auth/weak-password')) {
      displayMessage = 'Password too weak, please choose a stronger password.';
      field = 'password';
    } else if (message.includes('auth/invalid-email')) {
      displayMessage = 'Please enter a valid email address.';
      field = 'email';
    } else if (message.includes('auth/network-request-failed')) {
      displayMessage = 'Network error. Please check your internet connection.';
    } else {
      // Use the provided message if it doesn't match any known error
      displayMessage = message;
    }
  }
  
  // If a specific field is specified, show error under that field
  if (field) {
    const fieldErrorElement = document.getElementById(`${field}-error`);
    if (fieldErrorElement) {
      fieldErrorElement.textContent = displayMessage;
      fieldErrorElement.style.display = 'block';
      // Focus on the field with error
      const inputField = document.getElementById(field);
      if (inputField) inputField.focus();
    } else {
      // Fallback to main error if field error element not found
      if (errorElement) {
        errorElement.textContent = displayMessage;
        errorElement.style.color = '#d32f2f';
        errorElement.style.backgroundColor = 'rgba(211, 47, 47, 0.1)';
        errorElement.style.padding = '10px';
        errorElement.style.borderRadius = '4px';
        errorElement.style.marginBottom = '15px';
        errorElement.style.display = 'block';
      }
    }
  } else {
    // Show in main error element if no field specified
    if (errorElement) {
      errorElement.textContent = displayMessage;
      errorElement.style.color = '#d32f2f';
      errorElement.style.backgroundColor = 'rgba(211, 47, 47, 0.1)';
      errorElement.style.padding = '10px';
      errorElement.style.borderRadius = '4px';
      errorElement.style.marginBottom = '15px';
      errorElement.style.display = 'block';
      
      // Scroll to error message
      errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      console.error('Error element not found. Error was:', message);
    }
  }
}

// Check authentication state
let authStateChecked = false;
let redirectInProgress = false;

// Initialize signup process flag
window.isSignupProcess = false;

auth.onAuthStateChanged(function(user) {
  const currentPath = window.location.pathname;
  
  // Prevent infinite redirects by checking if we've already processed auth state
  // or if a redirect is already in progress, or if we're in a signup/logout process
  if (!redirectInProgress && !window.isSignupProcess && !window.isLogoutProcess) {
    
    if (user) {
      // User is signed in
      console.log('User is signed in:', user.displayName);
      
      // Only update session, no flash messages here
      fetch('/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'set',
          user: {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName
          }
        })
      });
      
      // Only redirect to home if we're on login/signup and it's not a logout process
      if ((currentPath === '/login' || currentPath === '/signup') && !window.isLogoutProcess) {
        redirectInProgress = true;
        console.log('Redirecting to home page...');
        setTimeout(() => {
          window.location.href = '/home';
        }, 500);
      }
    } else {
      // No user is signed in
      console.log('No user is signed in');
      
      // Clear session on server side
      fetch('/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'clear'
        })
      });
      
      // Only redirect to login if we're on protected pages and it's not already a logout process
      if (!window.isLogoutProcess && currentPath === '/home') {
        redirectInProgress = true;
        console.log('Redirecting to login page...');
        setTimeout(() => {
          window.location.href = '/login';
        }, 500);
      }
    }
    authStateChecked = true;
  }
});

// Sign up with email and password
function signupWithEmailPassword(email, password, name) {
  // Set the signup process flag BEFORE creating the user
  window.isSignupProcess = true;

  // Clear any existing flash messages first
  fetch('/set_flash', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: '',
      category: 'info'
    })
  });

  // Clear previous error messages
  document.getElementById('error-message').textContent = '';
  document.getElementById('error-message').style.display = 'none';
  
  // Clear all field errors
  const fieldErrors = document.querySelectorAll('.field-error');
  fieldErrors.forEach(el => el.textContent = '');
  
  // Show loading state
  document.getElementById('error-message').textContent = 'Creating account...';
  document.getElementById('error-message').style.color = '#4CAF50';
  document.getElementById('error-message').style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
  document.getElementById('error-message').style.padding = '10px';
  document.getElementById('error-message').style.borderRadius = '4px';
  document.getElementById('error-message').style.marginBottom = '15px';
  document.getElementById('error-message').style.display = 'block';
  
  // Disable the signup button to prevent multiple submissions
  const signupButton = document.querySelector('#signup-form button[type="submit"]');
  if (signupButton) signupButton.disabled = true;
  
  auth.createUserWithEmailAndPassword(email, password)
    .then((userCredential) => {
      console.log('Account created successfully');
      // Set flag to prevent auto-redirect during signup
      window.isSignupProcess = true;
      // Update profile with name
      return userCredential.user.updateProfile({
        displayName: name
      });
    })
    .then(() => {
      console.log('Profile updated successfully, preparing redirect');
      
      // Sign out the user
      return auth.signOut();
    })
    .then(() => {
      // Clear the signup flag and redirect to login with success message
      window.isSignupProcess = false;
      window.location.href = '/login?message=Sign up successful! Please log in to continue.';
    })
    .catch((error) => {
      console.error('Signup error:', error);
      
      // Reset the signup process flag on error
      window.isSignupProcess = false;
      
      // Show field-level error message
      if (error.code === 'auth/email-already-in-use') {
        showError(error.message, 'email');
      } else if (error.code === 'auth/weak-password') {
        showError(error.message, 'password');
      } else if (error.code === 'auth/invalid-email') {
        showError(error.message, 'email');
      } else {
        showError(error.message);
      }
      
      // Re-enable the signup button
      if (signupButton) signupButton.disabled = false;
    });
}

// Login with email and password
function loginWithEmailPassword(email, password) {
  // Clear any existing flash messages first
  fetch('/set_flash', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: '',
      category: 'info'
    })
  });

  // Clear previous error messages
  document.getElementById('error-message').textContent = '';
  document.getElementById('error-message').style.display = 'none';
  
  // Clear all field errors
  const fieldErrors = document.querySelectorAll('.field-error');
  fieldErrors.forEach(el => el.textContent = '');
  
  // Show loading state
  document.getElementById('error-message').textContent = 'Logging in...';
  document.getElementById('error-message').style.color = '#4CAF50';
  document.getElementById('error-message').style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
  document.getElementById('error-message').style.padding = '10px';
  document.getElementById('error-message').style.borderRadius = '4px';
  document.getElementById('error-message').style.marginBottom = '15px';
  document.getElementById('error-message').style.display = 'block';
  
  // Disable the login button to prevent multiple submissions
  const loginButton = document.querySelector('#login-form button[type="submit"]');
  if (loginButton) loginButton.disabled = true;
  
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => {
      return auth.signInWithEmailAndPassword(email, password);
    })
    .then((userCredential) => {
      console.log('Login successful:', userCredential.user.displayName);
      
      // Clear any existing flash messages
      return fetch('/set_flash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: '',
          category: 'success'
        })
      })
      .then(() => {
        // Then update session
        return fetch('/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'set',
            user: {
              uid: userCredential.user.uid,
              email: userCredential.user.email,
              displayName: userCredential.user.displayName
            }
          })
        });
      })
      .then(() => {
        // Set the actual login success message
        return fetch('/set_flash', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: 'Login successful! Welcome back.',
            category: 'success'
          })
        });
      })
      .then(() => {
        // Redirect to home page after all operations are complete
        window.location.href = '/home';
      });
    })
    .catch((error) => {
      console.error('Login error:', error);
      
      // Re-enable the login button
      if (loginButton) loginButton.disabled = false;
      
      // Show field-level error message
      if (error.code === 'auth/wrong-password') {
        showError(error.message, 'password');
      } else if (error.code === 'auth/user-not-found') {
        showError(error.message, 'email');
      } else if (error.code === 'auth/invalid-email') {
        showError(error.message, 'email');
      } else {
        showError(error.message);
      }
    });
}

// Sign in with Google
function googleSignIn(e) {
  // Clear any existing flash messages first
  fetch('/set_flash', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: '',
      category: 'info'
    })
  });

  const provider = new firebase.auth.GoogleAuthProvider();
  // Add scopes for better user data access
  provider.addScope('profile');
  provider.addScope('email');
  
  // Prevent form submission default behavior
  if (e) e.preventDefault();
  
  // Clear previous error messages
  document.getElementById('error-message').textContent = '';
  document.getElementById('error-message').style.display = 'none';
  
  // Show loading state
  document.getElementById('error-message').textContent = 'Signing in with Google...';
  document.getElementById('error-message').style.color = '#4CAF50';
  document.getElementById('error-message').style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
  document.getElementById('error-message').style.padding = '10px';
  document.getElementById('error-message').style.borderRadius = '4px';
  document.getElementById('error-message').style.marginBottom = '15px';
  document.getElementById('error-message').style.display = 'block';
  
  // Disable the Google login button to prevent multiple clicks
  const googleButton = document.getElementById('google-login') || document.getElementById('google-signup');
  if (googleButton) googleButton.disabled = true;
  
  // Set persistence to LOCAL to persist the session
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => {
      return auth.signInWithPopup(provider);
    })
    .then((result) => {
      // This gives you a Google Access Token
      const credential = result.credential;
      // The signed-in user info
      const user = result.user;
      console.log('Google Auth Successful:', user.displayName);
      
      // Send flash message data to server
      fetch('/set_flash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Login successful!',
          category: 'success'
        })
      });
      
      // Update session on server side
      fetch('/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'set',
          user: {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName
          }
        })
      })
      .then(() => {
        // Send login success flash message
        return fetch('/set_flash', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: 'Login successful! Welcome back.',
            category: 'success'
          })
        });
      })
      .then(() => {
        // Redirect to home page after successful login
        redirectInProgress = true;
        setTimeout(() => {
          window.location.href = '/home';
        }, 500);
      });
    })
    .catch((error) => {
      // Handle errors
      console.error('Google Auth Error:', error);
      let errorMessage = error.message || 'Error signing in with Google';
      showError(errorMessage);
      // Re-enable the Google button
      if (googleButton) googleButton.disabled = false;
    });
}

// Reset Password
function sendPasswordResetEmail(email) {
  // Validate email
  if (!email || !email.includes('@')) {
    return Promise.reject(new Error('Please enter a valid email address'));
  }
  
  return auth.sendPasswordResetEmail(email)
    .then(() => {
      console.log('Password reset email sent successfully');
      return Promise.resolve('Password reset email sent successfully. Please check your inbox.');
    })
    .catch((error) => {
      console.error('Error sending password reset email:', error);
      return Promise.reject(error);
    });
}

// Flag to control logout process
window.isLogoutProcess = false;

// Sign out user
// Make the function globally accessible
window.signOutUser = function() {
  console.log('Starting logout process...');
  // Set the logout flag before signing out
  window.isLogoutProcess = true;
  redirectInProgress = true;
  
  // First send request to server-side logout
  fetch('/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    }
  }).then(() => {
    console.log('Server-side logout successful, signing out from Firebase...');
    return auth.signOut();
  }).then(() => {
    console.log('Firebase sign out successful, redirecting to login...');
    // Keep the logout flag true as we're intentionally logging out
    window.location.href = '/login?message=Logged out successfully.&category=success';
  }).catch((error) => {
    console.error('Error during logout process:', error);
    showError(error.message);
    // Reset the flags on error
    window.isLogoutProcess = false;
    redirectInProgress = false;
    // Still try to redirect
    window.location.href = '/login?message=Logged out successfully.&category=success';
  });
}

// Add logout functionality to all logout buttons
document.addEventListener('DOMContentLoaded', function() {
    // Try to find logout button by ID first
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', window.signOutUser);
    }
    
    // Also add listener to any button with logout-btn class
    const logoutBtns = document.getElementsByClassName('logout-btn');
    for (let btn of logoutBtns) {
        if (btn !== logoutBtn) { // Skip if it's the same button we already handled
            btn.addEventListener('click', window.signOutUser);
        }
    }
});
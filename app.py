import os
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"  # Hide TF warnings

from tensorflow.keras.models import load_model

# Load model for inference only
model = load_model("Medicinal_plant8_Not.h5", compile=False)


from flask import Flask, render_template, request, redirect, url_for, jsonify, session, flash
import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing import image
from tensorflow.keras.metrics import AUC
import google.generativeai as genai
import numpy as np
import os
from werkzeug.utils import secure_filename
import base64
from PIL import Image
import io
import functools
import requests
from dotenv import load_dotenv
from gtts import gTTS
import json
import firebase_admin
from firebase_admin import credentials, firestore
import datetime

# Load environment variables from .env file
load_dotenv()

# Configure API key for Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Initialize Firebase Admin SDK
cred_path = os.path.join(os.path.dirname(__file__), 'firebase-credentials.json')
if not os.path.exists(cred_path):
    # Create a default credentials file if it doesn't exist
    cred_data = {
        "type": "service_account",
        "project_id": "medicinal-herbs-identification"
    }
    with open(cred_path, 'w') as f:
        json.dump(cred_data, f)

try:
    # Initialize Firebase Admin SDK
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("Firebase Firestore initialized successfully")
except Exception as e:
    print(f"Error initializing Firebase: {e}")
    print("Using mock Firebase database for demonstration purposes")
    db = None
    
    # Create a mock database class for demonstration
    class MockFirestore:
        def __init__(self):
            self.data = {}
            
        def collection(self, collection_name):
            if collection_name not in self.data:
                self.data[collection_name] = {}
            return MockCollection(self, collection_name)
    
    class MockCollection:
        def __init__(self, db, collection_name):
            self.db = db
            self.collection_name = collection_name
            
        def document(self, doc_id):
            return MockDocument(self.db, self.collection_name, doc_id)
            
        def add(self, data):
            import uuid
            doc_id = str(uuid.uuid4())
            self.document(doc_id).set(data)
            return doc_id
            
        def order_by(self, field, direction=None):
            return self
            
        def limit(self, count):
            return self
            
        def get(self):
            return []
    
    class MockDocument:
        def __init__(self, db, collection_name, doc_id):
            self.db = db
            self.collection_name = collection_name
            self.doc_id = doc_id
            if collection_name not in db.data:
                db.data[collection_name] = {}
            if doc_id not in db.data[collection_name]:
                db.data[collection_name][doc_id] = {}
                
        def collection(self, subcollection_name):
            collection_path = f"{self.collection_name}/{self.doc_id}/{subcollection_name}"
            return MockCollection(self.db, collection_path)
            
        def set(self, data):
            self.db.data[self.collection_name][self.doc_id] = data
            
        def update(self, data):
            if self.doc_id in self.db.data[self.collection_name]:
                self.db.data[self.collection_name][self.doc_id].update(data)
            
        def get(self):
            class MockDocSnapshot:
                def __init__(self, exists, data):
                    self._exists = exists
                    self._data = data
                    
                def exists(self):
                    return self._exists
                    
                def to_dict(self):
                    return self._data
            
            exists = self.doc_id in self.db.data[self.collection_name]
            data = self.db.data[self.collection_name].get(self.doc_id, {})
            return MockDocSnapshot(exists, data)
    
    # Create a mock database instance
    db = MockFirestore()

app = Flask(__name__)
app.secret_key = 'medicinal_plant_identification_secret_key'
app.debug = True  # Enable debug mode

# Configure allowed file extensions
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

# Test route to check if server is running
@app.route('/test')
def test():
    return jsonify({"status": "success", "message": "Server is running!"})

# Function to record user activity in Firestore
def record_user_activity(user_id, action, plant_name):
    if db is not None and user_id:
        try:
            # Create a reference to the user's activity collection
            activity_ref = db.collection('users').document(user_id).collection('activity')
            
            # Create activity data
            now = datetime.datetime.now()
            
            # Create activity document
            activity_data = {
                'action': action,
                'plant': plant_name,
                'timestamp': now.strftime('%Y-%m-%d %H:%M:%S'),
                'display_time': now.strftime('%Y-%m-%d %H:%M:%S')  # Will be formatted when displayed
            }
            
            # Add the activity to Firestore
            activity_ref.add(activity_data)
            
            # Update user's plants identified count
            user_ref = db.collection('users').document(user_id)
            user_doc = user_ref.get()
            if user_doc.exists:
                current_count = user_doc.to_dict().get('plantsIdentified', 0)
                user_ref.update({
                    'plantsIdentified': current_count + 1,
                    'lastPredictionAt': now.strftime('%Y-%m-%d %H:%M:%S')
                })
            
            return True
        except Exception as e:
            print(f"Error recording activity: {e}")
            return False
    return False

# Function to generate speech from text
def generate_speech(text: str, lang: str = 'en') -> str:
    try:
        # Create a temporary file with a unique name
        filename = f"speech_{hash(text)}.mp3"
        filepath = os.path.join('static', 'audio', filename)
        
        # Create audio directory if it doesn't exist
        os.makedirs(os.path.join('static', 'audio'), exist_ok=True)
        
        # Generate speech using gTTS
        tts = gTTS(text=text, lang=lang)
        tts.save(filepath)
        
        # Return the URL path to the audio file
        return url_for('static', filename=f'audio/{filename}')
    except Exception as e:
        app.logger.error(f"Text-to-speech error: {str(e)}")
        return None

# Function to call Gemini API using REST API
def call_gemini(prompt: str, lang: str = 'en') -> dict:
    try:
    #     # Use the Gemini API via REST
    #     url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent"
    #     # Add API key as a query parameter instead of Authorization header
    #     url = f"{url}?key={GEMINI_API_KEY}"
    #     headers = {"Content-Type": "application/json"}
    #     data = {"contents":[{"parts":[{"text": prompt}]}]}
        
    #     response = requests.post(url, headers=headers, json=data)
    #     response.raise_for_status()  # Raise exception for HTTP errors
        
    #     # Extract text from the response
    #     response_json = response.json()
    #     text_response = ""
    #     if "candidates" in response_json and response_json["candidates"]:
    #         if "content" in response_json["candidates"][0]:
    #             if "parts" in response_json["candidates"][0]["content"]:
    #                 if "text" in response_json["candidates"][0]["content"]["parts"][0]:
    #                     text_response = response_json["candidates"][0]["content"]["parts"][0]["text"]
        
        GOOGLE_API_KEY = "AIzaSyAckN1SpNL95cxlqOnFxyEkrXXIujDqX-Y"
        genai.configure(api_key=GOOGLE_API_KEY)
        # Pick your model
        model = genai.GenerativeModel("gemini-flash-latest")
        # Generate content
        text_response = model.generate_content(prompt).text
        print(text_response)
        if not text_response:
            text_response = "⚠️ Sorry, I couldn't process your question. Please try again later."
        
        # Generate speech for the response
        audio_url = generate_speech(text_response, lang)
        
        return {
            "text": text_response,
            "audio_url": audio_url
        }
    except Exception as e:
        app.logger.error(f"Gemini API error: {str(e)}")
        error_message = f"⚠️ Gemini API error: {str(e)}"
        return {
            "text": error_message,
            "audio_url": generate_speech(error_message, lang)
        }
    
# Function to retrieve relevant documents (placeholder for FAISS retrieval)
def retrieve_relevant_docs(plant_class: str) -> str:
    # This would normally use FAISS to retrieve relevant documents
    # For now, we'll return some basic information about common medicinal plants
    plant_info = {
        "Aloe vera": "Aloe vera is known for its gel that can be used for skin conditions, burns, and has anti-inflammatory properties. It contains vitamins, enzymes, minerals, and has antibacterial and antifungal properties.",
        "Tulsi": "Tulsi (Holy Basil) is used in Ayurvedic medicine for common colds, headaches, stomach disorders, inflammation, heart disease, and malaria. It has adaptogenic properties that help the body adapt to stress.",
        "Neem": "Neem has antibacterial, antifungal, and blood-purifying properties. It's used for skin diseases, dental care, and as a natural pesticide.",
        "Turmeric": "Turmeric contains curcumin which has powerful anti-inflammatory and antioxidant properties. It's used for arthritis, digestive issues, and may have anticancer properties."
    }
    
    # Return info for the specific plant if available, otherwise return general info
    return plant_info.get(plant_class, f"Information about {plant_class} and its medicinal properties, traditional uses, and scientific research on its effectiveness for various health conditions.")

dependencies = {
    'auc_roc': AUC
}

verbose_name = {
0: 'Abelmoschus sagittifolius',
1: 'Abrus precatorius',
2: 'Abutilon indicum',
3: 'Acanthus integrifolius',
4: 'Acorus tatarinowii',
5: 'Agave americana',
6: 'Ageratum conyzoides',
7: 'Allium ramosum',
8: 'Alocasia macrorrhizos',
9: 'Aloe vera',
10: 'Alpinia officinarum',
11: 'Amomum longiligulare',
12: 'Ampelopsis cantoniensis',
13: 'Andrographis paniculata',
14: 'Angelica dahurica',
15: 'Ardisia sylvestris',
16: 'Artemisia vulgaris',
17: 'Artocarpus altilis',
18: 'Artocarpus heterophyllus',
19: 'Artocarpus lakoocha',
20: 'Asparagus cochinchinensis',
21: 'Asparagus officinalis',
22: 'Averrhoa carambola',
23: 'Baccaurea sp',
24: 'Barleria lupulina',
25: 'Bengal Arum',
26: 'Berchemia lineata',
27: 'Bidens pilosa',
28: 'Bischofia trifoliata',
29: 'Blackberry Lily',
30: 'Blumea balsamifera',
31: 'Boehmeria nivea',
32: 'Breynia vitis',
33: 'Caesalpinia sappan',
34: 'Callerya speciosa',
35: 'Callisia fragrans',
36: 'Calophyllum inophyllum',
37: 'Calotropis gigantea',
38: 'Camellia chrysantha',
39: 'Caprifoliaceae',
40: 'Capsicum annuum',
41: 'Carica papaya',
42: 'Catharanthus roseus',
43: 'Celastrus hindsii',
44: 'Celosia argentea',
45: 'Centella asiatica',
46: 'Citrus aurantifolia',
47: 'Citrus hystrix',
48: 'Clausena indica',
49: 'Cleistocalyx operculatus',
50: 'Clerodendrum inerme',
51: 'Clinacanthus nutans',
52: 'Clycyrrhiza uralensis fish',
53: 'Coix lacryma-jobi',
54: 'Cordyline fruticosa',
55: 'Costus speciosus',
56: 'Crescentia cujete Lin',
57: 'Crinum asiaticum',
58: 'Crinum latifolium',
59: 'Croton oblongifolius',
60: 'Croton tonkinensis',
61: 'Curculigo gracilis',
62: 'Curculigo orchioides',
63: 'Cymbopogon',
64: 'Datura metel',
65: 'Derris elliptica',
66: 'Dianella ensifolia',
67: 'Dicliptera chinensis',
68: 'Dimocarpus longan',
69: 'Dioscorea persimilis',
70: 'Eichhoriaceae crassipes',
71: 'Eleutherine bulbosa',
72: 'Erythrina variegata',
73: 'Eupatorium fortunei',
74: 'Eupatorium triplinerve',
75: 'Euphorbia hirta',
76: 'Euphorbia pulcherrima',
77: 'Euphorbia tirucalli',
78: 'Euphorbia tithymaloides',
79: 'Eurycoma longifolia',
80: 'Excoecaria cochinchinensis',
81: 'Excoecaria sp',
82: 'Fallopia multiflora',
83: 'Ficus auriculata',
84: 'Ficus racemosa',
85: 'Fructus lycii',
86: 'Glochidion eriocarpum',
87: 'Glycosmis pentaphylla',
88: 'Gonocaryum lobbianum',
89: 'Gymnema sylvestre',
90: 'Gynura divaricata',
91: 'Hemerocallis fulva',
92: 'Hemigraphis glaucescens',
93: 'Hibiscus mutabilis',
94: 'Hibiscus rosa sinensis',
95: 'Hibiscus sabdariffa',
96: 'Holarrhena pubescens',
97: 'Homalomena occulta',
98: 'Houttuynia cordata',
99: 'Imperata cylindrica',
100: 'Iris domestica',
101: 'Ixora coccinea',
102: 'Jasminum sambac',
103: 'Jatropha gossypiifolia',
104: 'Jatropha multifida',
105: 'Jatropha podagrica',
106: 'Justicia gendarussa',
107: 'Kalanchoe pinnata',
108: 'Lactuca indica',
109: 'Lantana camara',
110: 'Lawsonia inermis',
111: 'Leea rubra',
112: 'Litsea Glutinosa',
113: 'Lonicera dasystyla',
114: 'Lpomoea sp',
115: 'Maesa',
116: 'Mallotus barbatus',
117: 'Mangifera',
118: 'Melastoma malabathricum',
119: 'Mentha Spicata',
120: 'Microcos tomentosa',
121: 'Micromelum falcatum',
122: 'Millettia pulchra',
123: 'Mimosa pudica',
124: 'Morinda citrifolia',
125: 'Moringa oleifera',
126: 'Morus alba',
127: 'Mussaenda philippica',
128: 'Nelumbo nucifera',
129: 'Not-a-Medicinal-Plant',
130: 'Ocimum basilicum',
131: 'Ocimum gratissimum',
132: 'Ocimum sanctum',
133: 'Oenanthe javanica',
134: 'Ophiopogon japonicus',
135: 'Paederia lanuginosa',
136: 'Pandanus amaryllifolius',
137: 'Pandanus sp',
138: 'Pandanus tectorius',
139: 'Parameria Laevigata',
140: 'Passiflora foetida',
141: 'Pereskia Sacharosa',
142: 'Persicaria odorata',
143: 'Phlogacanthus turgidus',
144: 'Phrynium placentarium',
145: 'Phyllanthus Reticulatus Poir',
146: 'Piper betle',
147: 'Piper sarmentosum',
148: 'Plantago',
149: 'Platycladus orientalis',
150: 'Plectranthus amboinicus',
151: 'Pluchea pteropoda Hemsl',
152: 'Plukenetia volubilis',
153: 'Plumbago indica',
154: 'Plumeris rubra',
155: 'Polyginum cuspidatum',
156: 'Polyscias fruticosa',
157: 'Polyscias guilfoylei',
158: 'Polyscias scutellaria',
159: 'Polyscias zeylanica',
160: 'Premna serratifolia',
161: 'Pseuderanthemum latifolium',
162: 'Psidium guajava',
163: 'Psychotria reevesii Wall',
164: 'Psychotria rubra',
165: 'Quisqualis indica',
166: 'Rauvolfia',
167: 'Rauvolfia tetraphylla',
168: 'Rhinacanthus nasutus',
169: 'Rhodomyrtus tomentosa',
170: 'Ruellia tuberosa',
171: 'Sanseviera canaliculata Carr',
172: 'Sansevieria hyacinthoides',
173: 'Sarcandra glabra',
174: 'Sauropus androgynus',
175: 'Schefflera heptaphylla',
176: 'Schefflera venulosa',
177: 'Senna alata',
178: 'Sida acuta Burm',
179: 'Solanum Mammosum',
180: 'Solanum torvum',
181: 'Spilanthes acmella',
182: 'Spondias dulcis',
183: 'Stachytarpheta jamaicensis',
184: 'Stephania dielsiana',
185: 'Stereospermum chelonoides',
186: 'Streptocaulon juventas',
187: 'Syzygium nervosum',
188: 'Tabernaemontana divaricata',
189: 'Tacca subflabellata',
190: 'Tamarindus indica',
191: 'Terminalia catappa',
192: 'Tradescantia discolor',
193: 'Trichanthera gigantea',
194: 'Vernonia amygdalina',
195: 'Vitex negundo',
196: 'Xanthium strumarium',
197: 'Zanthoxylum avicennae',
198: 'Zingiber officinale',
199: 'Ziziphus mauritiana',
200: 'helicteres hirsuta'
}

# Load the pre-trained model
model = load_model('Medicinal_plant8_Not.h5')



def predict_label(img_path=None, img_data=None):
    if img_path:
        test_image = image.load_img(img_path, target_size=(180,180))
    elif img_data:
        test_image = Image.open(io.BytesIO(img_data))
        test_image = test_image.resize((180, 180))
    
    test_image = image.img_to_array(test_image)/255.0
    test_image = test_image.reshape(1, 180, 180, 3)

    predict_x = model.predict(test_image) 
    classes_x = np.argmax(predict_x, axis=1)
    predicted_plant = verbose_name[classes_x[0]]
    
    return predicted_plant

# Authentication decorator
def login_required(f):
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            flash('Access denied. Please log in first.', 'error')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# Route for login page
@app.route("/")
@app.route("/login")
def login():
    if 'user' in session:
        return redirect(url_for('home'))
    # Clear any existing flash messages
    session.pop('_flashes', None)
    # Get message from query parameter if exists
    message = request.args.get('message')
    if message:
        flash(message, 'success')
    return render_template('login.html')

# Route to handle login form submission
@app.route("/handle_login", methods=['POST'])
def handle_login():
    data = request.get_json()
    if data and 'uid' in data:
        session['user'] = data
        # Update login timestamp
        update_user_login_timestamp(data['uid'])
        return jsonify({'status': 'success', 'redirect': url_for('home')})
    return jsonify({'status': 'error', 'message': 'Invalid login data'})

# Route for signup page
@app.route("/signup")
def signup():
    if 'user' in session:
        return redirect(url_for('home'))
    return render_template('signup.html')

# Function to update user login timestamp
def update_user_login_timestamp(user_id):
    if db is not None:
        try:
            user_ref = db.collection('users').document(user_id)
            user_doc = user_ref.get()
            
            now = datetime.datetime.now()
            update_data = {
                'lastLoginAt': now.strftime('%Y-%m-%dT%H:%M:%S.%fZ')
            }
            
            # If this is a new user, set the createdAt timestamp
            if not user_doc.exists:
                update_data['createdAt'] = now.strftime('%Y-%m-%dT%H:%M:%S.%fZ')
            
            user_ref.set(update_data, merge=True)
            return True
        except Exception as e:
            print(f"Error updating login timestamp: {e}")
            return False
    return False

# Route for home page (protected)
@app.route('/home')
@login_required
def home():
    # Pass current year for footer copyright
    if 'user' in session:
        update_user_login_timestamp(session['user']['uid'])
    return render_template('home.html', now=datetime.datetime.now())

# Route for plant identification page (protected)
@app.route("/index")
@login_required
def index():
    return render_template("index.html")

@app.route('/Performance')
@login_required
def performance():
    # Route for the performance page showing model training metrics
    return render_template('performance.html')

@app.route('/history')
@login_required
def history():
    # Redirect history to profile page
    return redirect(url_for('profile'))

@app.route('/profile')
@login_required
def profile():
    # User profile page
    user_data = {}
    recent_activity = []
    
    if db is not None and 'user' in session:
        user_id = session['user']['uid']
        
        # Get user profile data from Firestore
        user_ref = db.collection('users').document(user_id)
        user_doc = user_ref.get()
        
        if user_doc.exists:
            user_data = user_doc.to_dict()
            
            # Format timestamps for display
            for timestamp_field in ['createdAt', 'lastLoginAt']:
                if timestamp_field in user_data and user_data[timestamp_field]:
                    try:
                        if isinstance(user_data[timestamp_field], str):
                            try:
                                # Try ISO format first
                                timestamp = datetime.datetime.strptime(user_data[timestamp_field], '%Y-%m-%dT%H:%M:%S.%fZ')
                            except ValueError:
                                try:
                                    # Try our standard format as fallback
                                    timestamp = datetime.datetime.strptime(user_data[timestamp_field], '%Y-%m-%d %H:%M:%S')
                                except ValueError as e:
                                    print(f"Error parsing timestamp: {e}")
                                    user_data[timestamp_field] = 'N/A'
                                    continue
                        else:
                            timestamp = user_data[timestamp_field]
                        
                        if timestamp_field == 'createdAt':
                            user_data[timestamp_field] = timestamp.strftime('%B %d, %Y')
                        else:
                            user_data[timestamp_field] = timestamp.strftime('%B %d, %Y %I:%M %p')
                    except (ValueError, TypeError) as e:
                        print(f"Error formatting {timestamp_field}: {e}")
                        user_data[timestamp_field] = 'N/A'
            
            # Update session with the latest user data
            session['user'].update({
                'displayName': user_data.get('displayName', session['user'].get('displayName', '')),
                'email': user_data.get('email', session['user'].get('email', '')),
                'photoURL': user_data.get('photoURL', None)
            })
            session.modified = True
        else:
            # Create a new user document if it doesn't exist
            now = datetime.datetime.now()
            created_at = now.strftime('%Y-%m-%dT%H:%M:%S.%fZ')
            
            user_data = {
                'displayName': session['user'].get('displayName', ''),
                'email': session['user'].get('email', ''),
                'phoneNumber': '',
                'location': '',
                'bio': '',
                'photoURL': None,
                'createdAt': created_at,
                'lastLoginAt': created_at,
                'plantsIdentified': 0,
                'lastPredictionAt': None
            }
            
            # Format display timestamps
            user_data['createdAt_display'] = now.strftime('%B %d, %Y')
            user_data['lastLoginAt_display'] = now.strftime('%B %d, %Y %I:%M %p')
            # Save the new user data to Firebase
            user_ref.set(user_data)
            # Update session with the new user data
            session['user'].update({
                'displayName': user_data['displayName'],
                'email': user_data['email'],
                'photoURL': user_data['photoURL']
            })
            session.modified = True
        
        # Get recent activity from Firestore
        activity_ref = db.collection('users').document(user_id).collection('activity')
        try:
            # Get the 5 most recent activities
            activity_docs = activity_ref.order_by('timestamp', direction=firestore.Query.DESCENDING).limit(5).get()
            
            for doc in activity_docs:
                activity = doc.to_dict()
                if activity.get('timestamp'):
                    try:
                        # Parse the timestamp string
                        try:
                            # Try ISO format first
                            timestamp = datetime.datetime.strptime(activity['timestamp'], '%Y-%m-%dT%H:%M:%S.%fZ')
                        except ValueError:
                            # Try standard format as fallback
                            timestamp = datetime.datetime.strptime(activity['timestamp'], '%Y-%m-%d %H:%M:%S')
                        now = datetime.datetime.now()
                        
                        # Calculate display time
                        if timestamp.date() == now.date():
                            display_time = f"Today, {timestamp.strftime('%I:%M %p')}"
                        elif timestamp.date() == (now.date() - datetime.timedelta(days=1)):
                            display_time = f"Yesterday, {timestamp.strftime('%I:%M %p')}"
                        else:
                            display_time = timestamp.strftime('%B %d, %Y %I:%M %p')
                        
                        activity['display_time'] = display_time
                        recent_activity.append(activity)
                    except (ValueError, TypeError) as e:
                        print(f"Error parsing timestamp for activity: {e}")
            
            # Sort activities by timestamp (newest first)
            recent_activity.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
            
        except Exception as e:
            print(f"Error fetching activities: {e}")
            recent_activity = []
            
        print(f"Found {len(recent_activity)} recent activities") # Debug log
    
    return render_template('profile.html', user_data=user_data, recent_activity=recent_activity)

@app.route('/upload_profile_photo', methods=['POST'])
@login_required
def upload_profile_photo():
    if 'photo' not in request.files:
        return jsonify({'status': 'error', 'message': 'No photo uploaded'})
    
    photo = request.files['photo']
    if photo.filename == '':
        return jsonify({'status': 'error', 'message': 'No photo selected'})
    
    if photo and db is not None:
        # Create uploads directory if it doesn't exist
        uploads_dir = os.path.join('static', 'uploads')
        if not os.path.exists(uploads_dir):
            os.makedirs(uploads_dir)
        
        # Save the photo with user ID in filename
        user_id = session['user']['uid']
        filename = f"profile_{user_id}.jpg"
        photo_path = os.path.join(uploads_dir, filename)
        photo.save(photo_path)
        
        # Update the profile photo URL in Firebase
        user_ref = db.collection('users').document(user_id)
        photo_url = url_for('static', filename=f'uploads/{filename}', _external=True)
        
        user_ref.update({
            'photoURL': photo_url,
            'updatedAt': datetime.datetime.now()
        })
        
        return jsonify({'status': 'success', 'message': 'Photo uploaded successfully', 'path': photo_path})
    
    return jsonify({'status': 'error', 'message': 'Error uploading photo'})

@app.route('/update_profile', methods=['POST'])
@login_required
def update_profile():
    data = request.get_json()
    user_id = session['user']['uid']
    
    if db is not None and data:
        # Update user profile in Firestore
        user_ref = db.collection('users').document(user_id)
        
        # Get current user data
        user_doc = user_ref.get()
        current_data = user_doc.to_dict() if user_doc.exists else {}
        
        # Prepare update data
        update_data = {
            'displayName': data.get('displayName', current_data.get('displayName', '')),
            'phoneNumber': data.get('phoneNumber', current_data.get('phoneNumber', '')),
            'location': data.get('location', current_data.get('location', '')),
            'bio': data.get('bio', current_data.get('bio', '')),
            'updatedAt': datetime.datetime.now()
        }
        
        # Update the user document in Firestore
        user_ref.update(update_data)
        
        # Update session data
        session['user'].update({
            'displayName': update_data['displayName']
        })
        session.modified = True
        
        return jsonify({
            'status': 'success', 
            'message': 'Profile updated successfully',
            'data': update_data
        })
    
    return jsonify({'status': 'error', 'message': 'Failed to update profile'})

# Route for logout
@app.route("/logout", methods=['GET', 'POST'])
def logout():
    # First set the flash message before clearing session
    flash('Logout successful.', 'error')
    
    # Then clear only user session data, keeping flash messages
    session.pop('user', None)
    
    # Always redirect to login page with message parameter to ensure it shows
    return redirect(url_for('login', message='Logged out successfully.', category='error'))

# Route for setting flash messages from JavaScript
@app.route("/set_flash", methods=['POST'])
def set_flash():
    if request.method == 'POST':
        data = request.get_json()
        if data and 'message' in data:
            # Clear any existing flash messages
            session.pop('_flashes', None)
            flash(data['message'], data.get('category', 'info'))
            return jsonify({"status": "success"})
    return jsonify({"status": "error", "message": "Invalid request"})

# Route for session management (used by Firebase authentication)
@app.route("/session", methods=['POST'])
def manage_session():
    if request.method == 'POST':
        data = request.get_json()
        if data.get('action') == 'set':
            session['user'] = data.get('user')
            return jsonify({"status": "success", "message": "Session created"})
        elif data.get('action') == 'clear':
            session.pop('user', None)
            return jsonify({"status": "success", "message": "Session cleared"})
    return jsonify({"status": "error", "message": "Invalid request"})

# Route for image prediction
@app.route("/predict", methods=['POST'])
def predict():
    if 'user' not in session:
        return jsonify({"status": "error", "message": "Unauthorized"})
        
    try:
        if request.method == 'POST':
            # Create uploads directory if it doesn't exist (moved outside conditional blocks)
            os.makedirs('static/uploads', exist_ok=True)
            
            # Check if the request contains a file upload
            if 'image' in request.files:
                img = request.files['image']
                if img.filename != '':
                    # Save the uploaded file
                    filename = secure_filename(img.filename)
                    img_path = os.path.join('static/uploads', filename)
                    img.save(img_path)
                    
                    # Get prediction
                    prediction = predict_label(img_path=img_path)
                    
                    # Record user activity in Firestore
                    user_id = session['user']['uid']
                    record_user_activity(user_id, 'Identified', prediction)
                    
                    return jsonify({
                        "status": "success",
                        "prediction": prediction,
                        "image_path": img_path
                    })
            
            # Check if the request contains base64 image data (from webcam)
            elif 'image_data' in request.form:
                image_data = request.form['image_data']
                if image_data.startswith('data:image'):
                    # Extract the base64 encoded data
                    image_data = image_data.split(',')[1]
                    image_bytes = base64.b64decode(image_data)
                    
                    # Get prediction from the decoded image
                    prediction = predict_label(img_data=image_bytes)
                    
                    # Save the image for reference
                    img_path = os.path.join('static/uploads', f"webcam_{session['user']['uid']}.jpg")
                    with open(img_path, 'wb') as f:
                        f.write(image_bytes)
                    
                    # Record user activity in Firestore
                    user_id = session['user']['uid']
                    record_user_activity(user_id, 'Identified', prediction)
                    
                    return jsonify({
                        "status": "success",
                        "prediction": prediction,
                        "image_path": img_path
                    })
        
        return jsonify({"status": "error", "message": "No image provided"})
    except Exception as e:
        app.logger.error(f"Prediction error: {str(e)}")
        return jsonify({"status": "error", "message": str(e)})


	
# Route for uploading plant class
@app.route("/upload", methods=['POST'])
def upload():
    if 'user' not in session:
        return jsonify({"status": "error", "message": "Unauthorized"})
    
    try:
        data = request.get_json()
        if data and 'plant_class' in data:
            # Store plant class in session
            session['plant_class'] = data['plant_class']
            # Reset chat history
            session['history'] = []
            
            return jsonify({
                "status": "success", 
                "plant": session['plant_class']
            })
        
        return jsonify({"status": "error", "message": "No plant class provided"})
    except Exception as e:
        app.logger.error(f"Upload error: {str(e)}")
        return jsonify({"status": "error", "message": str(e)})

# Language code mapping
LANGUAGE_CODES = {
    'en': 'en',  # English
    'hi': 'hi',  # Hindi
    'mr': 'mr'   # Marathi
}

# Route for asking questions about the plant
@app.route("/ask", methods=['POST'])
def ask():
    if 'user' not in session:
        return jsonify({"status": "error", "message": "Unauthorized"})
    
    try:
        data = request.get_json()
        if data and 'question' in data:
            # Get the question, language, and plant class
            question = data['question']
            language = data.get('language', 'en')
            plant_class = session.get('plant_class', 'Unknown plant')
            
            # Get the appropriate language code for TTS
            lang_code = LANGUAGE_CODES.get(language, 'en')
            
            # Define messages for different languages
            not_medicinal_messages = {
                'en': "As it is not a Medicinal Plant, I can't give any information about it. Please upload proper image of any Medicinal Plant.",
                'hi': "क्योंकि यह औषधीय पौधा नहीं है, मैं इसके बारे में कोई जानकारी नहीं दे सकता। कृपया किसी औषधीय पौधे की उचित छवि अपलोड करें।",
                'mr': "हे औषधी वनस्पती नसल्याने, मी याबद्दल कोणतीही माहिती देऊ शकत नाही. कृपया कोणत्याही औषधी वनस्पतीचे योग्य चित्र अपलोड करा."
            }
            
            # Define messages for non-medicinal plant related questions
            off_topic_messages = {
                'en': "I'm sorry, I can only answer questions related to medicinal plants. Please ask me something about medicinal plants, their properties, or their uses.",
                'hi': "मुझे खेद है, मैं केवल औषधीय पौधों से संबंधित प्रश्नों का उत्तर दे सकता हूं। कृपया मुझसे औषधीय पौधों, उनके गुणों या उनके उपयोग के बारे में कुछ पूछें।",
                'mr': "मला माफ करा, मी फक्त औषधी वनस्पतींशी संबंधित प्रश्नांची उत्तरे देऊ शकतो. कृपया मला औषधी वनस्पती, त्यांचे गुणधर्म किंवा त्यांचे उपयोग याबद्दल काहीतरी विचारा."
            }
            
            # Keywords related to medicinal plants to check if the question is relevant
            medicinal_plant_keywords = [
                'plant', 'herb', 'medicinal', 'medicine', 'healing', 'cure', 'remedy', 'treatment',
                'leaf', 'root', 'stem', 'flower', 'seed', 'bark', 'extract', 'decoction', 'infusion',
                'ayurveda', 'traditional', 'herbal', 'botanical', 'species', 'grow', 'cultivation',
                'property', 'benefit', 'effect', 'use', 'application', 'disease', 'condition', 'symptom',
                'health', 'therapeutic', 'natural', 'organic', 'alternative', 'supplement', 'tea',
                'oil', 'powder', 'preparation', 'dosage', 'side effect', 'contraindication'
            ]
            
            # Check if the question is related to medicinal plants
            is_plant_related = any(keyword.lower() in question.lower() for keyword in medicinal_plant_keywords)
            
            # If the question is not related to medicinal plants, return appropriate message
            if not is_plant_related:
                # Get message in selected language (default to English if language not found)
                message = off_topic_messages.get(language, off_topic_messages['en'])
                response_data = {
                    "text": message,
                    "audio_url": None
                }
                response_data["audio_url"] = generate_speech(message, lang_code)
                return jsonify({"status": "success", **response_data})
            
            # Check if it's not a medicinal plant
            if plant_class == "Not-a-Medicinal-Plant":
                # Get message in selected language (default to English if language not found)
                message = not_medicinal_messages.get(language, not_medicinal_messages['en'])
                response_data = {
                    "text": message,
                    "audio_url": None
                }
                response_data["audio_url"] = generate_speech(message, lang_code)
                return jsonify({"status": "success", **response_data})
            else:
                # Retrieve relevant documents
                context = retrieve_relevant_docs(plant_class)
                
                # Build prompt for Gemini with formatting instructions
                prompt = f"""
                You are an expert medicinal botanist. Please provide the response in the following language: {language}.
                
                Plant: {plant_class}
                Question: {question}
                
                Context:
                {context}
                
                Instructions for your answer:
                - Keep it very concise to the point only.
                - No need to add any extra info.
                - Use bullet points or numbered lists if appropriate.
                - Do NOT write very long paragraphs.
                
                Answer:
                """
                
                # Call Gemini API with language parameter
                response = call_gemini(prompt, lang_code)
                
                # Extract text from response
                answer_text = response.get('text', '')
                if not answer_text:
                    answer_text = "I couldn't find specific information about this plant based on your question. Please try asking something else."
                
                # Generate audio for the response if not already present
                audio_url = response.get('audio_url')
                if not audio_url:
                    audio_url = generate_speech(answer_text, lang_code)
            
            # Initialize or get the current history
            if 'history' not in session:
                session['history'] = []
            
            # Create new conversation entry with audio URL
            new_entry = {
                "question": question,
                "answer": answer_text,
                "audio_url": audio_url
            }
            
            # Update the history
            current_history = session.get('history', [])
            current_history.append(new_entry)
            session['history'] = current_history
            
            # Force the session to save
            session.modified = True
            
            # Log the successful response for debugging
            app.logger.info(f"Successfully answered question about {plant_class}: {question}")
            app.logger.info(f"History length: {len(session['history'])}")
            
            return jsonify({
                "status": "success",
                "plant": plant_class,
                "question": question,
                "text": answer_text,
                "audio_url": audio_url,
                "history": session['history']
            })
        
        return jsonify({"status": "error", "message": "No question provided"})
    except Exception as e:
        app.logger.error(f"Ask error: {str(e)}")
        return jsonify({"status": "error", "message": str(e)})

# Route for getting chat history
@app.route("/history", methods=['GET'])
def get_history():
    if 'user' not in session:
        return jsonify({"status": "error", "message": "Unauthorized"})
    
    plant_class = session.get('plant_class', 'Unknown plant')
    history = session.get('history', [])
    
    return jsonify({
        "status": "success",
        "plant": plant_class,
        "history": history
    })

# Route for text-to-speech conversion
@app.route("/text-to-speech", methods=['POST'])
def text_to_speech():
    try:
        data = request.get_json()
        if not data or 'text' not in data or 'language' not in data:
            return jsonify({"status": "error", "message": "Missing text or language"})

        text = data['text']
        lang = data['language']

        # Convert text to speech using global LANGUAGE_CODES mapping
        tts = gTTS(text=text, lang=LANGUAGE_CODES.get(lang, 'en'))
        
        # Save to memory buffer
        mp3_fp = io.BytesIO()
        tts.write_to_fp(mp3_fp)
        mp3_fp.seek(0)
        
        # Convert to base64 for sending to frontend
        audio_base64 = base64.b64encode(mp3_fp.read()).decode()
        
        return jsonify({
            "status": "success",
            "audio": audio_base64
        })
    except Exception as e:
        app.logger.error(f"Text-to-speech error: {str(e)}")
        return jsonify({"status": "error", "message": str(e)})

# Route for translation
@app.route("/translate", methods=['POST'])
def translate_text():
    try:
        data = request.get_json()
        if not data or 'text' not in data or 'target_language' not in data:
            return jsonify({"status": "error", "message": "Missing text or target language"})

        text = data['text']
        target_lang = data['target_language']

        # Use LibreTranslate API (free and open source)
        url = "https://libretranslate.de/translate"
        
        response = requests.post(url, json={
            "q": text,
            "source": "auto",
            "target": target_lang,
            "format": "text"
        })
        
        if response.status_code == 200:
            result = response.json()
            return jsonify({
                "status": "success",
                "translated_text": result["translatedText"]
            })
        else:
            return jsonify({
                "status": "error",
                "message": "Translation service error"
            })
            
    except Exception as e:
        app.logger.error(f"Translation error: {str(e)}")
        return jsonify({"status": "error", "message": str(e)})

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True, threaded=True)


	

	



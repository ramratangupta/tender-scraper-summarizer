import mysql.connector
import time
import google.generativeai as genai
from datetime import datetime
import os
from dotenv import load_dotenv
import re
#pip3 install mysql-connector-python python-dotenv google-generativeai
# Load environment variables
load_dotenv()
genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))
model = genai.GenerativeModel('gemini-pro')

# Database configuration
db_config = {
    'host': os.getenv('DB_HOST'),
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'database': os.getenv('DB_NAME')
}

def connect_to_database():
    try:
        connection = mysql.connector.connect(**db_config)
        return connection
    except mysql.connector.Error as error:
        print(error)
        return None
def get_unprocessed_tenders(connection):
    try:
        cursor = connection.cursor(dictionary=True)
        query = """
            SELECT tenderid, raw_description FROM tenders WHERE status = 0
        """
        cursor.execute(query)
        tenders = cursor.fetchall()
        cursor.close()
        return tenders
    except mysql.connector.Error as error:
        print(error)
        return []

def normalize_newlines(text):
    # First normalize all newlines to \n
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    
    # Replace 3 or more newlines with double newlines
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    return text.strip()
def generate_summary(tender):
    json_format = '''
    {
        "summary": "text here",
        "email": "email here",
        "phone": ["number1", "number2"],
        "requirements": ["req1", "req2"]
    }
    '''
    prompt = """
    Analyze this tender document and extract the following information in a valid JSON format:
    1. Brief summary of requirements
    2. Email
    3. Phone
    4. Key Requirements

    Return ONLY the JSON object with no additional text or markdown formatting.
    Use this exact format:
    {0}

    Tender text:
    {1}
    """.format(json_format, normalize_newlines(tender["raw_description"]))
    
    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(e)
        return None

def update_tender_summary(connection, tender_id, summary):
    try:
        print(summary)
        cursor = connection.cursor()
        update_query = """
            UPDATE tenders 
            SET aiml_summary = %s, status = 1, email = %s, phone = %s, requirements = %s
            WHERE tenderid = %s
        """
        #cursor.execute(update_query, (summary, datetime.now(), tender_id))
        #connection.commit()
        #cursor.close()
        return True
    except mysql.connector.Error as error:
        print(error)
        return False

def process_tenders():
    connection = connect_to_database()
    if not connection:
        return
    
    try:
        # Get all unprocessed tenders
        tenders = get_unprocessed_tenders(connection)
        print("Found unprocessed tenders",len(tenders))
        
        for tender in tenders:
            print("Processing tender ID: ",tender['tenderid'])
            
            # Generate summary using Gemini
            summary = generate_summary(tender)
            
            if summary:
                # Update the tender with the generated summary
                if update_tender_summary(connection, tender['tenderid'], summary):
                    print("Successfully processed tender")
                else:
                    print("Failed to update tender")
            
            # Wait for 30 seconds before processing the next tender
            print("Waiting 30 seconds before next processing...")
            time.sleep(30)
            
    except Exception as e:
        print(e)
    finally:
        connection.close()

if __name__ == "__main__":
    print("Starting tender processing...")
    process_tenders()
    print("Completed tender processing")
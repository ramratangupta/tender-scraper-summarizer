import redis
import time
import google.generativeai as genai
from datetime import datetime
import os
from dotenv import load_dotenv
import re
import json
from contextlib import contextmanager
#pip3 install redis python-dotenv google-generativeai
# Load environment variables
load_dotenv()
genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))
model = genai.GenerativeModel('gemini-pro')
# Redis connection using connection string
REDIS_URL = os.getenv('REDIS_URL')
redis_pool = redis.ConnectionPool.from_url(
    REDIS_URL
)

@contextmanager
def get_redis_connection():
    connection = redis.Redis(connection_pool=redis_pool)
    try:
        yield connection
    finally:
        connection.close()

def get_unprocessed_tenders():
    with get_redis_connection() as redis_client:
        try:
            return redis_client.keys("queue_tender_*")
        except Error as error:
            print(error)
            return []

def normalize_newlines(text):
    # First normalize all newlines to \n
    text = text.replace('\r\n', '\n')  # Windows style to Unix
    text = text.replace('\r', '\n')    # Old Mac style to Unix
    # Remove extra whitespace and normalize spacing
    lines = text.split('\n')
    cleaned_lines = []
    for line in lines:
        # Strip whitespace from each line
        line = line.strip()
        cleaned_lines.append(line)            
    
    # Join with single newlines
    normalized_text = '\n'.join(cleaned_lines)
    return normalized_text.strip()
def createChunks(text, chunk_size=50000):
    
    chunks = [text[i:i + chunk_size] for i in range(0, len(text), chunk_size)]
    return chunks
def callGenAI(textPromt):
    json_format = '''
    {
        "summary": "text here",
        "email": "email here",
        "phone": "number1,number2",
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
    """.format(json_format, textPromt)
    
    try:
        response = model.generate_content(prompt)
        return response.text.replace("```json", "").replace("```", "")
    except Exception as e:
        print(e)
        return None
def delay_execution(sleepseconds=30):
    print(f"Waiting {sleepseconds} seconds before next processing...")
    time.sleep(sleepseconds)
def generate_summary(raw_description):
    textPromt = normalize_newlines(raw_description)
    chunks = createChunks(textPromt)
    if len(chunks) == 1:
        delay_execution()
        return callGenAI(textPromt)
    chunk_summaries = []
    for chunk in chunks:
        chunk_summary = callGenAI(chunk)
        if chunk_summary:
            chunk_summaries.append(chunk_summary)
        delay_execution()
    formatted_summary = ""
    formatted_requirments = ""
    formatted_emails = ""
    formatted_phones = ""
    for chunk_summary in chunk_summaries:
        try:
            json_summary = json.loads(chunk_summary)
            
            # Handle each field with null checks and default values
            if json_summary.get("summary"):
                #print(json_summary["summary"])
                formatted_summary += json_summary["summary"] + "\n"
            
            if json_summary.get("email"):
                #print(json_summary["email"])
                formatted_emails += json_summary["email"] + "\n"
            
            # Handle list fields
            if json_summary.get("phone"):
                phones = json_summary["phone"]
                #print(json_summary["phone"])
                if isinstance(phones, list):
                    formatted_phones += ",".join(filter(None, phones)) + "\n"
                else:
                    formatted_phones += phones + "\n"
            if json_summary.get("requirements"):
                #print(json_summary["requirements"])
                requirements = json_summary["requirements"]
                if isinstance(requirements, list):
                    formatted_requirments += "\n".join(filter(None, requirements)) + "\n"
                    
        except json.JSONDecodeError as e:
            print(f"JSON parsing error: {e}")
            continue
        except Exception as e:
            print(f"Unexpected error: {e}")
            continue
    prompt = """
    Summaries after chunking:
    {0}

    Requirments after chunking:
    {1}

    Emails after chunking:
    {2}

    Phones after chunking:
    {3}
    """.format(formatted_summary, formatted_requirments,formatted_emails,formatted_phones)
    try:
        return callGenAI(prompt)
    except Exception as e:
        print(e)
        return None

def update_tender_summary(tender, summary):
    with get_redis_connection() as redis_client:
        try:
            json_summary = json.loads(summary)
            pipe = redis_client.pipeline()
            # Handle each field with null checks and default values
            formatted_summary = ""
            formatted_requirments = ""
            formatted_emails = ""
            formatted_phones = ""
            if json_summary.get("summary"):
                #print(json_summary["summary"])
                formatted_summary = json_summary["summary"]
            
            if json_summary.get("email"):
                formatted_emails = json_summary["email"]
            
            # Handle list fields
            if json_summary.get("phone"):
                phones = json_summary["phone"]
                #print(json_summary["phone"])
                if isinstance(phones, list):
                    formatted_phones = ",".join(filter(None, phones))
                else:
                    formatted_phones = phones
            if json_summary.get("requirements"):
                #print(json_summary["requirements"])
                requirements = json_summary["requirements"]
                if isinstance(requirements, list):
                    formatted_requirments = "\n".join(filter(None, requirements))
                else:
                    formatted_requirments = requirements
            tender["aiml_summary"]=formatted_summary
            tender["email"]=formatted_emails
            tender["phone"]=formatted_phones
            tender["requirements"]=formatted_requirments
            pipe.hset(f"tender:{tender['tenderid']}", mapping=tender)
            if 'lastDate' in tender:
                try:
                    timestamp = int(datetime.strptime(tender['lastDate'], '%Y-%m-%d').timestamp())
                    pipe.zadd('tenders:by:date', {tender['tenderid']: timestamp})
                except (ValueError, TypeError) as e:
                    print(f"Date conversion error for tender {tender['tenderid']}: {e}")
            pipe.execute()
        
            return True
        except Error as error:
            print(error)
            return False

def process_tenders():
    with get_redis_connection() as redis_client:
        try:
            # Get all unprocessed tenders
            tenders = get_unprocessed_tenders()
            print("Found unprocessed tenders",len(tenders))
            
            for redisKey in tenders:
                tender = json.loads(redis_client.get(redisKey).decode('utf-8'))
                print("Processing tender ID: ",tender['tenderid'])
                
                # Generate summary using Gemini
                summary = generate_summary(tender['raw_description'])
                
                if summary:
                    # Update the tender with the generated summary
                    if update_tender_summary(tender, summary):
                        print("Successfully processed tender")
                        # Remove the tender from the queue
                        redis_client.delete(redisKey)
                    else:
                        print("Failed to update tender")
                
                # Wait for 30 seconds before processing the next tender
                
        except Exception as e:
            print(e)

if __name__ == "__main__":
    print("Starting tender processing...")
    process_tenders()
    print("Completed tender processing")
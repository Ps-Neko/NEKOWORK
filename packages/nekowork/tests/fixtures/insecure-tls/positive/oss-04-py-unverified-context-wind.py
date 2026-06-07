import urllib.request, json 
import ssl, os

import pandas as pd
import matplotlib.pyplot as plt

# add your API key to system environment variables
# export API_KEY='your_api_key'

api_key = os.getenv('API_KEY')
# or you can directly assign the API key here

# Dataset ID for 15-minute wind power generation data
dataset_id = 75

# Define the time range for the data (UTC format)
#start_time = '2025-02-06T00:00:00Z'
#end_time = '2025-02-06T01:00:00Z'
# Needed when fetching data for a specific time range 

try:
    # Construct the API URL
    url = f"https://data.fingrid.fi/api/datasets/75"

    hdr ={
    # Request headers
    'Cache-Control': 'no-cache',
    'x-api-key': api_key,
    }

    req = urllib.request.Request(url, headers=hdr)

    req.get_method = lambda: 'GET'
      # Create an unverified SSL context
    context = ssl._create_unverified_context()

    response = urllib.request.urlopen(req, context=context)
    print(response.getcode())
    print(response.read().decode('utf-8'))  # Decode the response to handle non-ASCII characters
except Exception as e:
    print(e)
####################################
import json
import pandas as pd
from datetime import timedelta

# Load the data
with open('/Users/noraclawdbot/Documents/GitHub/QuickLifts-Web/docs/research/escalation_records.json') as f:
    data = json.load(f)

# Convert to DataFrame
df = pd.DataFrame(data)

# Convert timestamps to datetime
df['alertCreatedAt'] = pd.to_datetime(df['alertCreatedAt'])
df['clinicianOutreachAt'] = pd.to_datetime(df['clinicianOutreachAt'])

# Calculate same-day and next-day outreach
df['sameDay'] = df['clinicianOutreachAt'] <= df['alertCreatedAt'] + timedelta(days=1)
df['nextDay'] = df['clinicianOutreachAt'] <= df['alertCreatedAt'] + timedelta(days=2)

# Group by demographic
result = df.groupby('demographicTags').agg({
    'sameDay': 'mean',
    'nextDay': 'mean'
}).reset_index()

# Convert to percentage
result['sameDay'] *= 100
result['nextDay'] *= 100

# Output the results
analysis_file = '/Users/noraclawdbot/Documents/GitHub/QuickLifts-Web/docs/research/clinician_outreach_analysis.md'
with open(analysis_file, 'w') as f:
    f.write('# Clinician Outreach Analysis\n\n')
    f.write('This document analyzes the same-day and next-day clinician outreach percentages by demographic group.\n\n')
    f.write(result.to_markdown(index=False))

print('Analysis saved to', analysis_file)
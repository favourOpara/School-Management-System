import os
import psycopg2

conn = psycopg2.connect(os.environ.get('DATABASE_URL'))
conn.autocommit = True
cur = conn.cursor()
cur.execute('GRANT ALL ON SCHEMA public TO PUBLIC;')
cur.close()
conn.close()
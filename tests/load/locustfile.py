"""Faqat localhost uchun o‘qish yuklamasi. Muhit: .local/load-sessions.json."""
import itertools
import json
from pathlib import Path
from urllib.parse import urlparse
from locust import HttpUser, between, task

sessions=itertools.cycle(json.loads((Path(__file__).resolve().parents[2]/'.local/load-sessions.json').read_text()))

class CenterReader(HttpUser):
    wait_time=between(0.1,0.4)
    def on_start(self):
        if urlparse(self.host).hostname not in {'localhost','127.0.0.1','::1'}:
            raise RuntimeError('Yuklama faqat lokal serverda bajariladi.')
        self.client.cookies.set('sessionid',next(sessions))
    @task(3)
    def students(self):
        self.client.get('/api/v1/students/?search=Demo&page_size=25',name='O‘quvchi qidirish')
    @task(2)
    def groups(self):
        self.client.get('/api/v1/groups/?page_size=25',name='Guruhlar')
    @task(2)
    def lessons(self):
        self.client.get('/api/v1/lessons/?page_size=25',name='Jadval')
    @task(1)
    def dashboard(self):
        self.client.get('/api/v1/reports/financial/',name='Moliyaviy dashboard')

"""Keep the merged school metadata and generic stock scopes reproducible."""
import copy
import json
from pathlib import Path

CATALOG = json.loads(Path(__file__).with_name('school-tracks.json').read_text(encoding='utf-8'))
NEW_SCHOOLS = ['whu', 'sisu', 'nju', 'fudan']


def apply_schools(data):
    for key in ['version', 'updated', 'policyNote', 'languages', 'schools']:
        data[key] = copy.deepcopy(CATALOG[key])
    for item in data['oralItems']:
        item.update(copy.deepcopy(CATALOG['oralMetadata'].get(item['id'], {})))
        if item['id'] == 'speit-self-introduction':
            item['title'] = 'Self-introduction · 上海交通大学'
    return data


def extend_scope(items):
    for item in items:
        if item.get('schoolIds'):
            item['schoolIds'] = list(dict.fromkeys(item['schoolIds'] + NEW_SCHOOLS))


def apply_workflows(data):
    data['profiles'] = copy.deepcopy(CATALOG['profiles'])
    extend_scope(data['readings'])
    extend_scope(data['translations'])
    return data


def apply_difficulty(data):
    extend_scope([item for item in data['items'] if item['section'] in ['reading', 'translation']])
    return data


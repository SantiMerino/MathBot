"""Rangos de referencia de la rosa. No valida topes ni cabezal nuevo."""
import json
from pathlib import Path
import numpy as np

t = np.linspace(0, np.pi, 20001)
xr = -102.9 * np.cos(3*t) * np.cos(t)
yr = -102.9 * 1.3552 * np.cos(3*t) * np.sin(t)

def bounds(q):
    return [round(float(np.rad2deg(q).min()), 3), round(float(np.rad2deg(q).max()), 3)]

x, y = 220+xr, yr
c = (x*x+y*y-2*200**2)/(2*200**2)
assert np.all(np.abs(c) <= 1)
s2 = np.arccos(c)
s1 = np.arctan2(y,x)-np.arctan2(200*np.sin(s2),200+200*np.cos(s2))
sx = 200*np.cos(s1)+200*np.cos(s1+s2)
sy = 200*np.sin(s1)+200*np.sin(s1+s2)
assert np.max(np.hypot(sx-x,sy-y)) < 1e-8

x, y, z = 250+xr, yr, 5.0
e1 = np.arctan2(y,x)
r = np.hypot(x,y)-87
h = z-92
c = (r*r+h*h-135**2-147**2)/(2*135*147)
assert np.all(np.abs(c) <= 1)
e3 = -np.arccos(c)
e2 = np.arctan2(h,r)-np.arctan2(147*np.sin(e3),135+147*np.cos(e3))
rad = 135*np.cos(e2)+147*np.cos(e2+e3)+87
ex, ey = rad*np.cos(e1), rad*np.sin(e1)
ez = 92+135*np.sin(e2)+147*np.sin(e2+e3)
assert np.max(np.sqrt((ex-x)**2+(ey-y)**2+(ez-z)**2)) < 1e-8
stock_ok = ((np.rad2deg(e2)>=39) & (np.rad2deg(e2)<=120)
            & (np.rad2deg(e3)>=(-.6755*np.rad2deg(e2)-70.768))
            & (np.rad2deg(e3)<=(-.7165*np.rad2deg(e2)-13.144)))
result = {
    'samples': len(t), 'units': 'mm / degrees',
    'rose': {'A_mm':102.9, 'k':1.3552, 't':[0,'pi']},
    'SCARA': {'L1':200,'L2':200,'center':[220,0], 'q1':bounds(s1),'q2':bounds(s2),
              'Z_stroke_proposal_mm':60},
    'EEZY_original_TCP': {'L1':92,'L2':135,'L3':147,'L4':87,'center':[250,0,5],
                          'q1':bounds(e1),'q2':bounds(e2),'q3':bounds(e3),
                          'fraction_within_stock_q2_q3_limits':float(stock_ok.mean())},
    'scope':'Original mathematical TCP. New tool offsets, collisions, load and actual joint stops are not validated.'
}
Path(__file__).with_name('angulos_referencia_v3.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2))

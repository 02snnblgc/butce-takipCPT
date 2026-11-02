import fs from 'node:fs';
import path from 'node:path';

const manifestPath = path.resolve('android/app/src/main/AndroidManifest.xml');
if (!fs.existsSync(manifestPath)) {
  throw new Error('AndroidManifest.xml bulunamadı. Önce “npx cap add android” komutunu çalıştırın.');
}
let xml = fs.readFileSync(manifestPath, 'utf8');
const permissions = [
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.SCHEDULE_EXACT_ALARM'
];
for (const permission of permissions) {
  if (!xml.includes(`android:name="${permission}"`)) {
    xml = xml.replace('</manifest>', `    <uses-permission android:name="${permission}" />\n</manifest>`);
  }
}
fs.writeFileSync(manifestPath, xml, 'utf8');
console.log('Android bildirim ve tam zamanlı alarm izinleri AndroidManifest.xml dosyasına eklendi.');

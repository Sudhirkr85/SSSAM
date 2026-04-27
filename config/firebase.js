const admin = require('firebase-admin');

const initializeFirebase = () => {
  try {
    const serviceAccount = {
      projectId: 'sudhir-b1f77',
      privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC+GHjEOvpLty9t
Fj0B3PS8zxFLAQmFsZF6lkmXuWgELewSv21tx47r7kksK6Vi+qv4pHxFGiQyAmio
zvAzN6n8uS7U3XacYi5CGrXtFw069nEI0JyYn5vbNwEwjXuxGiEvrVQRFKKK5IAD
Fxu7AzRCF2pqdfrl8UoAx9W1Fz+QmyG4bfwP0tf6Gl9lGr8YmNziOgX4xPsEAFaM
rd9C7m0xOu3/xphcSpgrfmCchwVdeS6oEqCT696095fXxUtMt4EzzrkYnB9DONps
UacezJuAH4cosKV1QWbiKouEDO4XmaLdpstKIIvw3Pe+1ARYSF//WPxfLN+QmJvE
0x1bR2DZAgMBAAECggEAAROmJs4YM7ebRYVj2uDS7S9/Slv2rsLTy3gYO2SiyTvR
30UKc4K2/jjOfDFzrDZgoSFmDX/RO8ZYN9vmdbn9vZYwnAeutwRXUoJ1VDZTbyeP
AfihcN7A8EXPodiJvWhthRqXvkHnXo2Q3YvbrqYRiRDgyFWrbWbuZv4T/tY2uyon
SfZcxWFI0ejsPwOI3oWaStp/9jRq26gX+i2Q983l4ljj+LWPiLiqE6OzulSLuKI7
dWhtHowpvkHHldFWgVbZ9OTLA/C/eryNSDwJ/lTdoqaUfVDoRdibd13t8gX2eONS
1mZDOluSN1s552WT5O1bGuMMONQp3yZ8pIlwKiFNlQKBgQDforUrucrEMW7vOBtl
pBOyDFN70F0dxIEZkWwkHjWZqVGsHwuo8JNZyGPyrey1rULTQV4LJbT/bvrllHhX
Y5tl4lou76fFKDkf8NOxJMfkoWwTTW/3sJS5KRA/i1gULxYLU5olRBzLcgWIVaZc
c8lY0IrMv5Hs90Xw3x9M4wl3fQKBgQDZmysigVMHiNaBQZTI5jeGdaoVy4wassvA
QrDqOd0K2EFvIBhveB4SzK8Q2QqG4VvcpQMucy0TEiKRKCEcl0D25avVpJCMYpqH
mmcSgz6+VwLURV5Kv4cP0suEYWIANOZFdj4egO0bAXLz6mkyKbbGsVtOG/uTUHju
vuG3yNGljQKBgQDd2rUuTp9X6M5rpNaRC6e6Tz4Wq0tk94c3TSvh3NJBwVZTkWzo
yNj1DbYRjvcv+FU97DAWkO6xJHDkhlioIRmNhnL+8yMVlOSuyiPILXvcVUM5Fu5H
4zZ3RcRntZ3IUDnnPKXD6IFEVrYkXQuv1fHeGOxJWJa0ZU5OOZr8lJLUpQKBgQCW
YCWB1c7z8PsTHafc4ULTt3JPV3c9Z/tnpG6vnkcDXIhza8GXHnHh2fLM+L/Oj+O0
aY/2RH+Mo0ah+xJOuLObKwIBRJTjfqx9MxUxdOMiE+0PldRgYVTLeYdMtyNLM0NC
E0FAQSYZOHog1wfVM4BsdFm9c5b5qW24xs4i/DLsbQKBgBxsM6hw6ZdMq4JksiCA
axbwNTAaNGzsws/KXS5ePDKeDyO0nlGAXOk6Zvz2mvB9oO5E3Mh2zqi2jJO5GDxU
o//qZftjcGqYLNO2/J1GtAQjCckY/+zRzltVXNzrKouqiGGD9vw6lj8/5b06UEy3
PVHbpnfzax7ySQ+xfXn2L9q9
-----END PRIVATE KEY-----`,
      clientEmail: 'firebase-adminsdk-fbsvc@sudhir-b1f77.iam.gserviceaccount.com',
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log('Firebase Admin SDK initialized successfully');
    return admin;
  } catch (error) {
    console.error('Firebase initialization error:', error.message);
    return null;
  }
};

const getMessaging = () => {
  return admin.messaging();
};

module.exports = { initializeFirebase, getMessaging, admin };

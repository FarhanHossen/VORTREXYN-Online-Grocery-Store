// ============================================================
// config/firebase-admin.js — Firebase Admin SDK initialisation
//
// The Admin SDK gives the server privileged access to Firebase services
// without needing a user's credentials:
//   - admin.firestore()  → read/write any Firestore document
//   - admin.auth()       → verify ID tokens, delete user accounts
//   - admin.storage()    → upload product images to Firebase Storage
//
// The guard `if (!admin.apps.length)` prevents the app from being
// initialised twice when this module is required from multiple files.
//
// ⚠️  SECURITY NOTE:
// The service account private key is embedded here for convenience
// during development. In a production setup, move the key to an
// environment variable (FIREBASE_PRIVATE_KEY) and load it via process.env.
// Never commit private keys to a public git repository.
// ============================================================

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type:                        'service_account',
      project_id:                  'vortrexyn-online-grocery-store',
      private_key_id:              '935dd1c90a9712f16fdb07c3966ca87408cf4004',
      private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDEU2+zR2VKFJaY\nE3RiAJ0pRUq23bc4wRiX93RkwUkF4aFklmfrcQ2jgWH37lnF5JQehcUQ28Fdjlfu\n5EDlR6Syrkgr3qjp0h6+Z52SB/uboPwvkii/GDONqHu/yoF+rmVNwM3RvF4ScICt\nV4HvzgcbFlGNtqbZMDlsR/ASDhUaSAfVi8QsGz48NEXzzY723wYHiJogqnXq0EVr\n1OUUkXbcnEWT+gr4tavsbdHFDkkL8EeH00ehyDTjVo0A1J4j4dJ0i804WewpXpnP\ni9e6qIH54iaTN6dE1E4cElkCNWkJ2tCShadIQH53/evZm2ARnG9mx//8NIEjI5y/\niNUdP3lzAgMBAAECgf9/RneKH1PoHc3gbB4VKZaK6blzhIpkLiMukEvgJmA1b+J3\nShiXHxoC5fCKpcMK97BnJzEvhNgqkjky+edi4fgJJEvBdChFLFA2Zd68cAoGKdUu\nm3aSdXsuWusuErjJcQAWf2D4ck+YMFKBN9N0qBMmbl+acbfU+Z0NT9boFWxJuEBH\n6SNJgiy7MiCAoiUF4i0lwIYcKa3tu+ptgqcpZVM/LN2qQj6X4mmTtqGu2TFBOm2s\nRTbir/p6NtkDfiipsvtjW/wCJ0G8AkXTe+FLUXDLUNLUChaFRquF5COrWUnqc7U/\nb7CQwP0XMgHl+AmrrxPGDB+hBQnQ7jUhYclBO8ECgYEA9NK6LaK9gZG6Z77zDV8t\nWXg1CBC1CDjrpzcfdcKq0VuIT8h8ZcM6eEW1eQ3dXja8+W3NXkbPodu9kWPUeH3U\nV4pgOmTRZ/qARefKKZWxNFNxOmZXFeeaGnfOf34EdKFQeX17hIua12zJ8t2ki35Y\nPleXXIvK/F6gnOFkUSbiV+0CgYEAzUnqxagPiNxNaP4dGRBb2woqELReTqXI3llS\n9FdSmaGfyjS4yu8cw3VVh1xleHjXsSu8WoDQ0bzeD/zIqMYhqOpCwOYcfxVp+9D3\nXS66i4OB8mdW2l9Uhd9qvKJfYPUOV4uXDIWqqMxSTpM48r9VqQihpwX7j20AYf1K\nFcVIKt8CgYEA76NY05SpNCuFr0ksNVmFVT8hgZyA5uR4XfvJ0oXSmAylV5rhkOZQ\n1Cs/n5dfqHmh7fB5hh9/22nwm2CBN9PKxklPObk3dDSx3DsvGhdJFfPbMBO+iFVj\n9SZyPT8Hc3X3BIQ8JBhWXylAX3ZuOpBYJeWs5cx7yx2Azy6b+Ac8pF0CgYEAp1yM\npwmlaIlaHq+Un1tj14ZI1weFHw8vXH5sD8GlGJTYhWxH/0HDLGJbERi1rOqvxcQH\nMa11EJiuXVBTcqzcwi4Br+up7b1SgzZQhEpVUOospaez+iHf8ag8B39EzPHb+GlY\nAqByilzQ+TgzJEvylPTxfQ52kO5ncnuhy2/jrvcCgYAd3lR94hEsGtVXATjdrQix\noqVEeqHDqQYs+eZO9KA4/cYae9wXa9Rr1HfvVXE7BWa1n3GLP5oOBAMzbYQrmpoU\nSzgcQNFsfSiStCz00BzNjMmnHNf8Q0klO/lv3fIS1m9/S3XJdo0FVMIwiZJ1qvz7\nuAd+oqERCsC04swUbbVLWg==\n-----END PRIVATE KEY-----\n",
      client_email:                'firebase-adminsdk-fbsvc@vortrexyn-online-grocery-store.iam.gserviceaccount.com',
      client_id:                   '112782026558242818527',
      auth_uri:                    'https://accounts.google.com/o/oauth2/auth',
      token_uri:                   'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url:        'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40vortrexyn-online-grocery-store.iam.gserviceaccount.com',
      universe_domain:             'googleapis.com'
    }),
    projectId:     'vortrexyn-online-grocery-store',
    storageBucket: 'vortrexyn-online-grocery-store.firebasestorage.app'
  });
}

module.exports = admin;

UPDATE auth.users SET
  raw_app_meta_data = '{"provider":"email","providers":["email"]}',
  raw_user_meta_data = '{}',
  is_sso_user = false,
  is_anonymous = false
WHERE email IN ('jose@shoestore.com', 'rocio@shoestore.com');

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('./server'); // Assuming server.js exports the app

const usersFilePath = path.join(__dirname, 'users.json');

beforeEach(() => {
  // Clear users.json before each test
  if (fs.existsSync(usersFilePath)) {
    fs.writeFileSync(usersFilePath, JSON.stringify([]));
  }
});

describe('POST /api/signup', () => {
  it('should signup a new user', async () => {
    const res = await request(app)
      .post('/api/signup')
      .send({
        fullName: 'Test User',
        username: 'testuser',
        password: 'TestPass123',
      });
    expect(res.statusCode).toEqual(201);
    expect(res.body.message).toBe('Signup successful.');
  });

  it('should not signup with existing username', async () => {
    await request(app)
      .post('/api/signup')
      .send({
        fullName: 'Test User',
        username: 'testuser',
        password: 'TestPass123',
      });
    const res = await request(app)
      .post('/api/signup')
      .send({
        fullName: 'Another User',
        username: 'testuser',
        password: 'AnotherPass123',
      });
    expect(res.statusCode).toEqual(409);
    expect(res.body.message).toBe('Username already exists.');
  });

  it('should return 400 if required fields missing', async () => {
    const res = await request(app)
      .post('/api/signup')
      .send({
        username: 'user',
      });
    expect(res.statusCode).toEqual(400);
  });
});

describe('POST /api/login', () => {
  beforeEach(async () => {
    await request(app)
      .post('/api/signup')
      .send({
        fullName: 'Test User',
        username: 'testuser',
        password: 'TestPass123',
      });
  });

  it('should login with correct credentials', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({
        username: 'testuser',
        password: 'TestPass123',
      });
    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toBe('Login successful.');
    expect(res.body.user.username).toBe('testuser');
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('should not login with incorrect password', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({
        username: 'testuser',
        password: 'WrongPass',
      });
    expect(res.statusCode).toEqual(401);
    expect(res.body.message).toBe('Invalid username or password.');
  });

  it('should return 400 if fields missing', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({
        username: 'testuser',
      });
    expect(res.statusCode).toEqual(400);
  });
});

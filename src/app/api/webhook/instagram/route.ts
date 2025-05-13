import { NextRequest, NextResponse } from 'next/server';

const VERIFY_TOKEN = 'my_verification_token'; // Replace with your actual verify token, consider using environment variables

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Checks if a token and mode is in the query string of the request
  if (mode && token) {
    // Checks the mode and token sent is correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      // Responds with the challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      return new NextResponse(challenge, { status: 200 });
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      console.error('Failed validation. Make sure the validation tokens match.');
      return new NextResponse('Forbidden', { status: 403 });
    }
  } else {
    // Responds with '400 Bad Request' if mode or token are missing
    console.error('Missing webhook parameters.');
    return new NextResponse('Bad Request', { status: 400 });
  }
}

// Add POST handler for actual webhook events later
// export async function POST(request: NextRequest) {
//   // Handle incoming webhook events here
//   const body = await request.json();
//   console.log('Received webhook event:', body);
//   // Process the event...
//   return new NextResponse('EVENT_RECEIVED', { status: 200 });
// }

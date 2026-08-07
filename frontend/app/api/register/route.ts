import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Handle user registration requests
export async function POST(req: Request) {
  // Extract user information from the request body
  const { name, email, password } = await req.json();

  // Validate required fields
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  // Enforce minimum password length for security
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  // Check if an account with the provided email already exists
  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 },
    );
  }

  // Hash the user's password before storing it in the database
  const passwordHash = await bcrypt.hash(password, 12);

  // Create the new user and return only safe fields
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  // Return the newly created user with a 201 Created status
  return NextResponse.json({ user }, { status: 201 });
}
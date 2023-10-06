"use server";

import { revalidatePath } from "next/cache";
import Thread from "../models/thread";
import User from "../models/user";
import { connectToDB } from "../mongoose";

interface Params {
  text: string,
  author: string,
  communityId: string | null,
  path: string
}

export async function createThread({ text, author, communityId, path }: Params) {
  try {
    await connectToDB();
  
    const createdThread = await Thread.create({
      text,
      author,
      community: null
    });
  
    await User.findByIdAndUpdate(author, {
      $push: { threads: createdThread._id }
    });
  } catch (error: unknown) {
    throw new Error(`Error creating thread: ${error.message}`);
  }

  revalidatePath(path);
}
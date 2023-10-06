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
  } catch (error: any) {
    throw new Error(`Error creating thread: ${error.message}`);
  }

  revalidatePath(path);
}

export async function fetchThreads(pageNumber = 1, pageSize = 20) {
  try {
    await connectToDB();

    const skipAmount = (pageNumber - 1) * pageSize;

    const threadsQuery = Thread
      .find({ parentsId: { $in: [null, undefined] } })
      .sort({ createdAt: "desc" })
      .skip(skipAmount)
      .limit(pageSize)
      .populate({
        path: "author",
        model: User
      })
      .populate({
        path: "children",
        populate: {
          path: "author",
          model: User,
          select: "_id name parentId image"
        }
      })

      const totalThreadsCount = await Thread.countDocuments({ parentsId: { $in: [null, undefined] } });

      const threads = await threadsQuery.exec();

      const hasNext = totalThreadsCount > skipAmount + threads.length;

      return {
        threads,
        hasNext
      }
    
  } catch (error: any) {
    throw new Error(`Error fetching threads: ${error.message}`);
  }


}


export async function fetchThreadById(id: string) {
  try {
    await connectToDB();

    // @TODO populate community
    const thread = await Thread.findById(id)
      .populate({
        path: "author",
        model: User,
        select: "_id id name image"
      })
      .populate({
        path: "children",
        model: Thread,
        populate: [
          {
            path: "author",
            model: User,
            select: "_id id name parentId image"
          },
          {
            path: "children",
            model: Thread,
            populate: {
              path: "author",
              model: User,
              select: "_id id name parentId image"
            }
          }
        ],
      });

      return thread;

  } catch (error: any) {
    throw new Error(`Error fetching thread: ${error.message}`);
  }
}

export async function addCommentToThread({
  threadId,
  commentText,
  userId,
  path
}:{
  threadId: string,
  commentText: string,
  userId: string,
  path: string
} ) {
  try {
    await connectToDB();

    const originalThread = await Thread.findById(threadId);

    if(!originalThread) throw new Error("Thread not found");

    const commentThread = new Thread({
      text: commentText,
      author: userId,
      parentId: threadId
    })

    const savedCommentThread = await commentThread.save();

    originalThread.children.push(savedCommentThread._id);
    await originalThread.save();

    revalidatePath(path);
  } catch (error: any) {
    throw new Error(`Error adding comment: ${error.message}`);
  }
}

export const constants = {
  paths: {
    userCreate: '/api/user/:nickname/create',
    getUser: '/api/user/:nickname/profile',
    updateUser: '/api/user/:nickname/profile',
    getForumUsers: '/api/forum/:slug/users',

    forumCreate: '/api/forum/create',
    getForum: '/api/forum/:slug/details',
    forumThreads: '/api/forum/:slug/threads',

    threadCreate: '/api/forum/:slug/create',
    threadVote: '/api/thread/:slug_or_id/vote',
    getThread: '/api/thread/:slug_or_id/details',
    updateThread: '/api/thread/:slug_or_id/details',

    postCreate: '/api/thread/:slug_or_id/create',
    getPosts: '/api/thread/:slug_or_id/posts',
    getPostInfo: '/api/post/:id/details',
    updatePostInfo: '/api/post/:id/details',

    serviceStatus: '/api/service/status',
    clearAll: '/api/service/clear',
  },
};

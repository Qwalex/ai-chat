export const notify = async (text) => {
  try {
    await fetch('https://dev.qwalex.ru/notify/', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });
  } catch (error) {
    console.error("Failed to notify:", error);
  }
};

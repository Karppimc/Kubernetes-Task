# Task Details Tracker

This project is a **Task Details Tracker** web application that allows users to manage tasks and their associated time intervals effectively.
- Frontend is done by me with React
- Backend was provided by our teacher, added here for reference

## Features

### Task List
- Start/Stop/Delete tasks
- Filter task with tags
- Drag & Drop tasks to put them in any order you want
  ![image](https://github.com/user-attachments/assets/9082ee28-1529-4f47-bde9-ea0163a76401)

  

- **Task Management**
  - View a list of tasks fetched from the backend.
  - Add Tasks and give it tags that describe it
  - Add new Tags
  - Edit/Delete existing tasks
  - Filter tasks with tags
    ![image](https://github.com/user-attachments/assets/d9f19f7b-c03d-4b43-ab7d-6ae616a91fba)


- **Time Summary**
- Shows summary for time spent in each Task and Tag (Hours and minutes)
- You can specify time interval
  ![image](https://github.com/user-attachments/assets/a85e52a7-fc2e-43dd-bc2a-c6c0400305e6)

 
- **Task Details**
  - Display activity intervals (start and stop times) for the selected task.
  - Highlight overlapping intervals for better visibility.
  - Support for ongoing tasks with `Ongoing` label in the stop time column.
  - Set custom start and end times to filter activity intervals.
  - Add,edit and delete time intervals. Save changes to update changes to backend
  - Daily active times shown in bar chart that tells how many hours/minutes you have used in this task each day
    ![image](https://github.com/user-attachments/assets/c6837fed-c72e-4153-b926-6b1a8fc7aa52)
    ![image](https://github.com/user-attachments/assets/ac69c70c-ed99-40f4-a56e-cf61fffd10a6)

- **About page**
- Shows more info about this project


- **Error Handling**
  - Provides meaningful error messages when tasks or intervals fail to load.

### Installation

1. Clone the repository.
2. Navigate to the project directory: cd Tamk-Fullstack
3. npm install both front & Back end
4. npm run dev @ Front
5. npm run start @ Back
6. Open localhost:5173 to check the page


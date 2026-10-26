
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-student-accomplishments',
  imports: [FormsModule],
  templateUrl: './student-accomplishments.html',
  styleUrl: './student-accomplishments.css',
})
export class StudentAccomplishments {

  showAddForm = false;

  openAddForm(): void {
    this.showAddForm = true;
  }

  backToLogs(): void {
    this.showAddForm = false;
  }

}

import { Component } from '@angular/core';
import { LetterGameComponent } from './components/letter-game/letter-game.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [LetterGameComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'Don\'t Tap';
}

